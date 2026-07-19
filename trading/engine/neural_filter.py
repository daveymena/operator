import numpy as np
import pandas as pd
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix
import joblib
import os

SL_MULT = 1.5
TP_MULT = 3.0

class NeuralFilter:
    def __init__(self, model_path=None):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = None

    def prepare_features(self, df, params=None):
        from .hybrid_strategy import HybridStrategy

        p = params or {}
        ema_fast = p.get('ema_fast', 10)
        ema_slow = p.get('ema_slow', 30)
        williams_period = p.get('williams_period', 10)
        williams_upperband = p.get('williams_upperband', -15)
        williams_lowerband = p.get('williams_lowerband', -85)
        stoploss_pips = p.get('sl_atr_mult', 1.5)
        takeprofit_pips = p.get('tp_atr_mult', 3.0)

        # Use the hybrid strategy to generate signals
        strat = HybridStrategy(params)
        setups, data = strat.analyze(df)

        if not setups:
            return None, None, None

        # Features for each signal point
        feature_cols = []
        X_rows = []
        y_labels = []

        for s in setups:
            idx = s['index']
            if idx < 30 or idx >= len(data) - 30:
                continue

            row = data.iloc[idx]

            features = {
                'ema_fast': row['ema_fast'],
                'ema_slow': row['ema_slow'],
                'ema_diff_pct': row.get('ema_diff', 0),
                'williams_r': row.get('williams_r', -50),
                'atr': row.get('atr', 0.01),
                'close': row['close'],
                'returns_1': row['close'] / data.iloc[idx-1]['close'] - 1 if idx > 0 else 0,
                'returns_5': row['close'] / data.iloc[idx-5]['close'] - 1 if idx >= 5 else 0,
                'returns_10': row['close'] / data.iloc[idx-10]['close'] - 1 if idx >= 10 else 0,
                'volume_ratio': 1.0,
                'trend_up': 1 if row.get('trend_up', False) else 0,
                'bos_strength': 1 if 'BOS' in s.get('setup_type', '') else 0,
                'swing_high': 1 if row.get('swing_high', False) else 0,
                'swing_low': 1 if row.get('swing_low', False) else 0,
                'fvg_present': 1 if row.get('fvg_bullish', False) or row.get('fvg_bearish', False) else 0,
                'choch_present': 1 if row.get('choch_up', False) or row.get('choch_down', False) else 0,
                'oversold': 1 if row.get('oversold', False) else 0,
                'overbought': 1 if row.get('overbought', False) else 0,
            }

            for period in [5, 10, 20, 50, 100]:
                if idx >= period:
                    features[f'ema_{period}'] = data.iloc[idx]['close'] if f'ema_{period}' not in data.columns else data.iloc[idx][f'ema_{period}']
                else:
                    features[f'ema_{period}'] = features['close']

            atr_val = features['atr']
            entry = row['close']
            trade_type = s['type']

            for j in range(1, min(50, len(data) - idx)):
                bar = data.iloc[idx + j]
                sl_hit = False
                tp_hit = False

                if trade_type == 'buy':
                    sl_price = entry - atr_val * stoploss_pips
                    tp_price = entry + atr_val * takeprofit_pips
                    if bar['high'] >= tp_price:
                        tp_hit = True
                        break
                    if bar['low'] <= sl_price:
                        sl_hit = True
                        break
                else:
                    sl_price = entry + atr_val * stoploss_pips
                    tp_price = entry - atr_val * takeprofit_pips
                    if bar['low'] <= tp_price:
                        tp_hit = True
                        break
                    if bar['high'] >= sl_price:
                        sl_hit = True
                        break

            is_win = 1 if tp_hit else 0
            X_rows.append(features)
            y_labels.append(is_win)

        if not X_rows:
            return None, None, None

        X = pd.DataFrame(X_rows)
        feature_cols = [c for c in X.columns if c not in ['close']]
        self.feature_names = feature_cols
        return X[feature_cols].values, np.array(y_labels), None

    def train(self, df, params=None, test_size=0.2, balance=True):
        X, y, _ = self.prepare_features(df, params)
        if X is None or len(X) < 30:
            return None

        if balance:
            pos = y == 1
            neg = y == 0
            n_pos = pos.sum()
            n_neg = neg.sum()
            if n_pos > 0 and n_neg > 0:
                if n_pos < n_neg:
                    pos_idx = np.where(pos)[0]
                    neg_idx = np.random.choice(np.where(neg)[0], n_pos, replace=False)
                else:
                    neg_idx = np.where(neg)[0]
                    pos_idx = np.random.choice(np.where(pos)[0], n_neg, replace=False)
                all_idx = np.sort(np.concatenate([pos_idx, neg_idx]))
                X = X[all_idx]
                y = y[all_idx]

        X_scaled = self.scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=test_size, random_state=42, stratify=y)

        self.model = MLPClassifier(
            hidden_layer_sizes=(32, 16, 8),
            activation='relu', solver='adam', alpha=0.001,
            batch_size=16, learning_rate='adaptive',
            max_iter=200, early_stopping=True,
            validation_fraction=0.15, random_state=42,
        )
        self.model.fit(X_train, y_train)

        train_acc = self.model.score(X_train, y_train)
        test_acc = self.model.score(X_test, y_test)
        y_pred = self.model.predict(X_test)
        cm = confusion_matrix(y_test, y_pred)

        return {
            'train_accuracy': round(train_acc * 100, 2),
            'test_accuracy': round(test_acc * 100, 2),
            'samples': len(X),
            'test_samples': len(X_test),
            'confusion_matrix': cm.tolist(),
            'feature_names': self.feature_names,
        }

    def _extract_features(self, row, data, idx, setup, df, params=None):
        from .regime_detector import RegimeDetector
        regime = RegimeDetector()

        local_regime = regime.analyze(data.iloc[max(0, idx-100):idx+1])

        atr_mean = data['atr'].mean()
        atr_std = data['atr'].std()
        atr = row.get('atr', 0.01)
        atr_z = (atr - atr_mean) / atr_std if atr_std > 0 else 0

        atr_percentile = 0
        if len(data) > 0:
            atr_vals = data['atr'].values
            atr_percentile = float(np.mean(atr_vals[:idx+1] <= atr_vals[idx]) * 100)

        trade_type = setup['type']
        williams_r = row.get('williams_r', -50)
        ema_diff = row.get('ema_diff', 0)

        ob_vol = 1.0
        if 'tick_volume' in row and idx >= 20:
            avg_vol = data['tick_volume'].iloc[idx-20:idx].mean()
            ob_vol = row['tick_volume'] / avg_vol if avg_vol > 0 else 1

        features = {
            'williams_r': williams_r,
            'williams_r_norm': williams_r / 100,
            'ema_diff_pct': ema_diff,
            'atr_z_score': round(atr_z, 4),
            'atr_percentile': round(atr_percentile, 1),
            'trend_strength': local_regime.get('trend_strength', 50) / 100,
            'volatility': 0 if local_regime.get('volatility') == 'low' else (1 if local_regime.get('volatility') == 'normal' else 2),
            'regime_trending': 1 if 'trending' in local_regime.get('regime', '') else 0,
            'regime_ranging': 1 if local_regime.get('regime') == 'ranging' else 0,
            'regime_volatile': 1 if local_regime.get('regime') == 'volatile' else 0,
            'bb_width': local_regime.get('bb_width', 0),
            'close_vs_ema_fast_pct': (row['close'] / row['ema_fast'] - 1) * 100 if 'ema_fast' in row else 0,
            'close_vs_ema_slow_pct': (row['close'] / row['ema_slow'] - 1) * 100 if 'ema_slow' in row else 0,
            'body_ratio': abs(row['close'] - row['open']) / (row['high'] - row['low']) if (row['high'] - row['low']) > 0 else 0.5,
            'ob_volume_ratio': ob_vol,
        }

        lookback = 10
        if idx >= lookback:
            returns = [data.iloc[idx - k]['close'] for k in range(1, lookback + 1)]
            returns = [(row['close'] - r) / r for r in returns]
            features['ret_1'] = returns[0] if len(returns) > 0 else 0
            features['ret_3'] = sum(returns[:3]) if len(returns) >= 3 else 0
            features['ret_5'] = sum(returns[:5]) if len(returns) >= 5 else 0
            features['ret_10'] = sum(returns) if len(returns) >= 10 else 0
            features['volatility_10'] = float(np.std(returns)) if len(returns) >= 5 else 0
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

        return features

    def predict(self, df, params=None):
        if self.model is None:
            return None

        from .hybrid_strategy import HybridStrategy
        p = params or {}
        strat = HybridStrategy(params)
        setups, data = strat.analyze(df)

        if not setups:
            return None

        latest = setups[-1]
        idx = latest['index']
        row = data.iloc[idx]

        features = self._extract_features(row, data, idx, latest, df, params)

        X = pd.DataFrame([features])
        if self.feature_names:
            missing = [c for c in self.feature_names if c not in X.columns]
            for c in missing:
                X[c] = 0
            X = X[self.feature_names]
        X_scaled = self.scaler.transform(X)
        prob = self.model.predict_proba(X_scaled)[0]
        pred = self.model.predict(X_scaled)[0]

        return {
            'prediction': int(pred),
            'probability': float(max(prob)),
            'prob_win': float(prob[1]),
            'prob_loss': float(prob[0]),
        }

    def save(self, filepath):
        if self.model is None:
            return False
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump({'model': self.model, 'scaler': self.scaler, 'features': self.feature_names}, filepath)
        return True

    def load(self, filepath):
        data = joblib.load(filepath)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_names = data['features']
        return True

    def _calc_atr(self, df, period=14):
        tr1 = df['high'] - df['low']
        tr2 = (df['high'] - df['close'].shift(1)).abs()
        tr3 = (df['low'] - df['close'].shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period).mean()
