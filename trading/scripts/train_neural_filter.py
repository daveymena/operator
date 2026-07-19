import os, sys, json, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import confusion_matrix, classification_report
import joblib

from engine.hybrid_strategy import HybridStrategy
from engine.regime_detector import RegimeDetector
from engine.config import SYMBOLS, PIP_VALUES

BOS_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
}

SL_MULT = 1.5
TP_MULT = 3.0

def prepare_training_data(df, symbol, params):
    strat = HybridStrategy(params)
    setups, data = strat.analyze(df)
    if not setups:
        return None, None, None

    regime = RegimeDetector()
    atr_mean = data['atr'].mean()
    atr_std = data['atr'].std()

    X_rows, y_labels = [], []

    for s in setups:
        idx = s['index']
        if idx < 50 or idx >= len(data) - 50:
            continue

        row = data.iloc[idx]

        # Look forward to determine outcome
        entry = row['close']
        atr = row['atr']
        trade_type = s['type']

        sl_price = entry - atr * SL_MULT if trade_type == 'buy' else entry + atr * SL_MULT
        tp_price = entry + atr * TP_MULT if trade_type == 'buy' else entry - atr * TP_MULT

        outcome = None
        max_favorable = 0
        max_adverse = 0
        bars_to_outcome = 50

        for j in range(1, min(80, len(data) - idx)):
            bar = data.iloc[idx + j]
            if trade_type == 'buy':
                if bar['high'] >= tp_price:
                    outcome = 1
                    bars_to_outcome = j
                    break
                if bar['low'] <= sl_price:
                    outcome = 0
                    bars_to_outcome = j
                    break
            else:
                if bar['low'] <= tp_price:
                    outcome = 1
                    bars_to_outcome = j
                    break
                if bar['high'] >= sl_price:
                    outcome = 0
                    bars_to_outcome = j
                    break

        if outcome is None:
            continue

        local_regime = regime.analyze(data.iloc[max(0, idx-100):idx+1])

        atr_z = (atr - atr_mean) / atr_std if atr_std > 0 else 0

        williams_r = row.get('williams_r', -50)
        ema_diff = row.get('ema_diff', 0)

        ob_vol = 0
        if 'tick_volume' in row and idx >= 20:
            avg_vol = data['tick_volume'].iloc[idx-20:idx].mean()
            ob_vol = row['tick_volume'] / avg_vol if avg_vol > 0 else 1

        features = {
            'williams_r': williams_r,
            'williams_r_norm': williams_r / 100,
            'ema_diff_pct': ema_diff,
            'atr_z_score': round(atr_z, 4),
            'atr_percentile': 0,
            'trend_strength': local_regime.get('trend_strength', 50) / 100,
            'volatility': 0 if local_regime.get('volatility') == 'low' else (1 if local_regime.get('volatility') == 'normal' else 2),
            'regime_trending': 1 if 'trending' in local_regime.get('regime', '') else 0,
            'regime_ranging': 1 if local_regime.get('regime') == 'ranging' else 0,
            'regime_volatile': 1 if local_regime.get('regime') == 'volatile' else 0,
            'bb_width': local_regime.get('bb_width', 0),
            'close_vs_ema_fast_pct': (row['close'] / row['ema_fast'] - 1) * 100,
            'close_vs_ema_slow_pct': (row['close'] / row['ema_slow'] - 1) * 100,
            'body_ratio': abs(row['close'] - row['open']) / (row['high'] - row['low']) if (row['high'] - row['low']) > 0 else 0.5,
            'ob_volume_ratio': ob_vol,
        }

        # Price action features
        lookback = 10
        if idx >= lookback:
            returns = []
            for k in range(1, lookback + 1):
                prev = data.iloc[idx - k]
                ret = (row['close'] - prev['close']) / prev['close']
                returns.append(ret)
            features['ret_1'] = returns[0] if len(returns) > 0 else 0
            features['ret_3'] = sum(returns[:3]) if len(returns) >= 3 else 0
            features['ret_5'] = sum(returns[:5]) if len(returns) >= 5 else 0
            features['ret_10'] = sum(returns) if len(returns) >= 10 else 0
            features['volatility_10'] = np.std(returns) if len(returns) >= 5 else 0
        else:
            features.update({'ret_1': 0, 'ret_3': 0, 'ret_5': 0, 'ret_10': 0, 'volatility_10': 0})

        features['bos_up'] = 1 if row.get('bos_up', False) else 0
        features['bos_down'] = 1 if row.get('bos_down', False) else 0
        features['choch_up'] = 1 if row.get('choch_up', False) else 0
        features['choch_down'] = 1 if row.get('choch_down', False) else 0
        features['fvg_bullish'] = 1 if row.get('fvg_bullish', False) else 0
        features['fvg_bearish'] = 1 if row.get('fvg_bearish', False) else 0
        features['oversold'] = 1 if row.get('oversold', False) else 0
        features['overbought'] = 1 if row.get('overbought', False) else 0
        features['trend_up'] = 1 if row.get('trend_up', False) else 0

        features['is_buy'] = 1 if trade_type == 'buy' else 0

        X_rows.append(features)
        y_labels.append(outcome)

    if not X_rows:
        return None, None, None

    X = pd.DataFrame(X_rows)
    y = np.array(y_labels)

    # ATR percentile (requires full data)
    atr_vals = data['atr'].values
    for i in range(len(X_rows)):
        idx = setups[i]['index']
        if idx >= 0 and idx < len(atr_vals):
            atr_perc = np.mean(atr_vals[:idx+1] <= atr_vals[idx]) * 100
            X.iloc[i, X.columns.get_loc('atr_percentile')] = atr_perc

    feature_names = [c for c in X.columns]
    return X.values, y, feature_names


def train_with_cv(X, y, feature_names, n_splits=5):
    skf = StratifiedKFold(n_splits=min(n_splits, min(np.sum(y==1), np.sum(y==0)) * 2), shuffle=True, random_state=42)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    cv_scores = []
    for train_idx, test_idx in skf.split(X_scaled, y):
        X_tr, X_te = X_scaled[train_idx], X_scaled[test_idx]
        y_tr, y_te = y[train_idx], y[test_idx]

        model = MLPClassifier(
            hidden_layer_sizes=(64, 32, 16),
            activation='relu', solver='adam', alpha=0.005,
            batch_size=32, learning_rate='adaptive',
            max_iter=300, early_stopping=True,
            validation_fraction=0.15, random_state=42,
        )
        model.fit(X_tr, y_tr)
        score = model.score(X_te, y_te)
        cv_scores.append(score)

    # Final model on ALL data
    final_model = MLPClassifier(
        hidden_layer_sizes=(64, 32, 16),
        activation='relu', solver='adam', alpha=0.005,
        batch_size=32, learning_rate='adaptive',
        max_iter=500, early_stopping=True,
        validation_fraction=0.1, random_state=42,
    )

    # Balance training
    pos = y == 1
    neg = y == 0
    n_pos = pos.sum()
    n_neg = neg.sum()

    if n_pos > 0 and n_neg > 0 and n_pos != n_neg:
        if n_pos < n_neg:
            pos_idx = np.where(pos)[0]
            neg_idx = np.random.choice(np.where(neg)[0], n_pos * 2, replace=(n_neg < n_pos * 2))
        else:
            neg_idx = np.where(neg)[0]
            pos_idx = np.random.choice(np.where(pos)[0], n_neg * 2, replace=(n_pos < n_neg * 2))
        all_idx = np.sort(np.concatenate([pos_idx, neg_idx]))
        X_bal = X_scaled[all_idx]
        y_bal = y[all_idx]
    else:
        X_bal, y_bal = X_scaled, y

    final_model.fit(X_bal, y_bal)

    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42, stratify=y)
    train_acc = final_model.score(X_train, y_train)
    test_acc = final_model.score(X_test, y_test)
    y_pred = final_model.predict(X_test)
    cm = confusion_matrix(y_test, y_pred)
    cr = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    y_proba = final_model.predict_proba(X_test)

    # Precision@threshold analysis
    thresholds = np.arange(0.3, 0.8, 0.05)
    best_f1 = 0
    best_threshold = 0.5
    for thresh in thresholds:
        y_t = (y_proba[:, 1] >= thresh).astype(int)
        tp = np.sum((y_t == 1) & (y_test == 1))
        fp = np.sum((y_t == 1) & (y_test == 0))
        fn = np.sum((y_t == 0) & (y_test == 1))
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = thresh

    return {
        'model': final_model,
        'scaler': scaler,
        'feature_names': feature_names,
        'train_accuracy': round(train_acc * 100, 2),
        'test_accuracy': round(test_acc * 100, 2),
        'cv_accuracy_mean': round(np.mean(cv_scores) * 100, 2),
        'cv_accuracy_std': round(np.std(cv_scores) * 100, 2),
        'samples': len(X),
        'test_samples': len(X_test),
        'confusion_matrix': cm.tolist(),
        'classification_report': cr,
        'best_threshold': round(best_threshold, 3),
        'best_f1': round(best_f1, 3),
        'n_pos': int(n_pos),
        'n_neg': int(n_neg),
    }


def main():
    print('=' * 80)
    print('  ENTRENAMIENTO DEL FILTRO NEURONAL (MLPClassifier)')
    print('  Estrategia: BOS Continuation + SMC')
    print('=' * 80)

    symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF']
    model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
    os.makedirs(model_dir, exist_ok=True)

    all_results = []

    for symbol in symbols:
        print(f'\n{"=" * 70}')
        print(f'  {symbol}')
        print(f'{"=" * 70}')

        fp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', f'{symbol}_H1.csv')
        if not os.path.exists(fp):
            print(f'  [!] No data file: {fp}')
            continue

        df = pd.read_csv(fp, index_col=0, parse_dates=True)
        print(f'  Datos: {len(df)} velas ({df.index[0].date()} a {df.index[-1].date()})')

        X, y, feature_names = prepare_training_data(df, symbol, BOS_PARAMS)
        if X is None or len(X) < 50:
            print(f'  [!] No suficientes setups: {0 if X is None else len(X)}')
            continue

        n_pos = int(np.sum(y))
        n_neg = int(len(y) - n_pos)
        print(f'  Setups totales: {len(X)} | Ganadores: {n_pos} ({n_pos/len(y)*100:.1f}%) | Perdedores: {n_neg} ({n_neg/len(y)*100:.1f}%)')

        report = train_with_cv(X, y, feature_names)

        model_path = os.path.join(model_dir, f'neural_filter_{symbol}.pkl')
        joblib.dump({
            'model': report['model'],
            'scaler': report['scaler'],
            'features': report['feature_names'],
            'threshold': report['best_threshold'],
            'train_acc': report['train_accuracy'],
            'test_acc': report['test_accuracy'],
        }, model_path)

        cm = report['confusion_matrix']
        print(f'  CV Accuracy: {report["cv_accuracy_mean"]}% ± {report["cv_accuracy_std"]}%')
        print(f'  Train Acc: {report["train_accuracy"]}% | Test Acc: {report["test_accuracy"]}%')
        print(f'  Best threshold: {report["best_threshold"]} (F1: {report["best_f1"]})')
        print(f'  Confusion matrix:')
        print(f'    TN={cm[0][0]}  FP={cm[0][1]}')
        print(f'    FN={cm[1][0]}  TP={cm[1][1]}')
        print(f'  Modelo guardado: neural_filter_{symbol}.pkl')

        all_results.append({
            'symbol': symbol,
            'samples': report['samples'],
            'win_rate': round(n_pos / len(y) * 100, 1),
            'cv_acc': report['cv_accuracy_mean'],
            'train_acc': report['train_accuracy'],
            'test_acc': report['test_accuracy'],
            'threshold': report['best_threshold'],
            'f1': report['best_f1'],
        })

    print(f'\n{"=" * 80}')
    print(f'  RESUMEN FINAL')
    print(f'{"=" * 80}')
    print(f'  {"Symbol":8s} | {"Samples":7s} | {"WR%":5s} | {"CV Acc":6s} | {"Train":6s} | {"Test":6s} | {"Thresh":6s} | F1')
    print(f'  {"-"*60}')
    for r in all_results:
        print(f'  {r["symbol"]:8s} | {r["samples"]:7d} | {r["win_rate"]:4.1f}% | {r["cv_acc"]:5.1f}% | {r["train_acc"]:5.1f}% | {r["test_acc"]:5.1f}% | {r["threshold"]:.2f}  | {r["f1"]:.3f}')
    print(f'{"=" * 80}')

    # Save training report
    report_path = os.path.join(model_dir, 'training_report.json')
    with open(report_path, 'w') as f:
        json.dump(all_results, f, indent=2)
    print(f'  Reporte guardado: {report_path}')
    print(f'  Total modelos: {len(all_results)}/{len(symbols)}')

if __name__ == '__main__':
    main()
