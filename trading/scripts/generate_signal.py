import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
import joblib
from engine.hybrid_strategy import HybridStrategy
from engine.hybrid_backtester import HybridBacktester
from engine.neural_filter import NeuralFilter
from engine.regime_detector import RegimeDetector
from engine.risk_manager import RiskManager
from engine.partial_profit import PartialProfitManager

BOS_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
    'require_wr_confirmation': True,
    'require_trend_alignment': True,
    'avoid_hours': [0, 7, 10, 11, 18],
}

def load_data(symbol, candles_json=None):
    if candles_json and candles_json != 'undefined':
        candles = json.loads(candles_json)
        df = pd.DataFrame(candles)
        if 'timestamp' in df.columns:
            df.set_index('timestamp', inplace=True)
        df.index = pd.to_datetime(df.index)
        return df

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    filepath = os.path.join(data_dir, f'{symbol}_H1.csv')
    if os.path.exists(filepath):
        df = pd.read_csv(filepath, index_col=0, parse_dates=True)
        df = df.tail(500)
        return df

    from engine.data_provider import DataProvider
    dp = DataProvider()
    df = dp.get_recent_data(symbol, 'H1', days=30)
    return df

def get_best_signal(setups):
    if not setups:
        return None
    best = max(setups, key=lambda s: s['confidence'])
    return best

def get_neural_filter_approval(symbol, df, params):
    model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', f'neural_filter_{symbol}.pkl')
    if not os.path.exists(model_path):
        return None
    try:
        data = joblib.load(model_path)
        threshold = data.get('threshold', 0.55)
        nf = NeuralFilter()
        nf.model = data['model']
        nf.scaler = data['scaler']
        nf.feature_names = data['features']
        pred = nf.predict(df, params)
        if pred:
            pred['threshold'] = threshold
            pred['approved'] = pred['probability'] >= threshold
        return pred
    except:
        return None

def main():
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'
    candles_json = sys.argv[2] if len(sys.argv) > 2 else None

    df = load_data(symbol, candles_json)
    if df is None or len(df) < 100:
        result = {'ok': False, 'error': f'No data for {symbol}', 'symbol': symbol}
        print(json.dumps(result))
        return

    params = BOS_PARAMS.copy()
    strat = HybridStrategy(params)
    setups, data = strat.analyze(df)

    regime = RegimeDetector().analyze(df)
    risk = RiskManager()

    best = get_best_signal(setups)

    nn = get_neural_filter_approval(symbol, df, params)
    nn_approved = None
    if nn:
        nn_approved = nn.get('approved', False)

    last_price = float(data['close'].iloc[-1]) if len(data) > 0 else 0

    signal_out = None
    if best:
        final_confidence = best['confidence']
        if nn is not None:
            if nn_approved:
                final_confidence = min(final_confidence + 15, 99)
            else:
                final_confidence = max(final_confidence - 20, 0)

        balance = 10000.0
        risk_check = risk.validate_trade(best, balance, symbol)
        trade_allowed = risk_check['valid']

        signal_out = {
            'type': best['type'],
            'entry': best['entry'],
            'sl': best['sl'],
            'tp': best['tp'],
            'confidence': round(final_confidence, 1),
            'rr': best['rr'],
            'setup_type': best['setup_type'],
            'reasons': best['reasons'],
            'indicators': best['indicators'],
            'trade_allowed': trade_allowed,
            'risk_reason': risk_check.get('reason') if not trade_allowed else None,
        }

    result = {
        'ok': True,
        'symbol': symbol,
        'timestamp': str(pd.Timestamp.now()),
        'last_price': last_price,
        'total_setups': len(setups),
        'signal': signal_out,
        'regime': regime.get('regime', 'unknown'),
        'volatility': regime.get('volatility', 'unknown'),
        'trend_strength': regime.get('trend_strength', 0),
        'atr': round(regime.get('current_atr', 0), 5),
        'neural_filter': nn,
        'indicators': {
            'ema_fast': float(data['ema_fast'].iloc[-1]) if 'ema_fast' in data.columns else 0,
            'ema_slow': float(data['ema_slow'].iloc[-1]) if 'ema_slow' in data.columns else 0,
            'williams_r': float(data['williams_r'].iloc[-1]) if 'williams_r' in data.columns else 0,
        } if len(data) > 0 else {},
    }
    print(json.dumps(result, default=str))

if __name__ == '__main__':
    main()
