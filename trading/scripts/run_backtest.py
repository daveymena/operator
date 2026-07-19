import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.hybrid_backtester import HybridBacktester
from engine.config import DEFAULT_PARAMS

BOS_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False,
    'enable_bos': True,
    'enable_ema_w': False,
}

def main():
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'
    params_json = sys.argv[2] if len(sys.argv) > 2 else '{}'
    params = json.loads(params_json) if params_json else BOS_PARAMS

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    filepath = os.path.join(data_dir, f'{symbol}_H1.csv')

    if os.path.exists(filepath):
        df = pd.read_csv(filepath, index_col=0, parse_dates=True)
    else:
        from engine.data_provider import DataProvider
        dp = DataProvider()
        df = dp.get_historical_data(symbol, 'H1', 2)

    bt = HybridBacktester()
    results = bt.run(df, params, symbol)
    for t in results.get('trades', []):
        for k in ['entry_time', 'exit_time']:
            if k in t:
                t[k] = str(t[k])
    results['trades'] = results.get('trades', [])[-200:]
    print(json.dumps(results, default=str))

if __name__ == '__main__':
    main()
