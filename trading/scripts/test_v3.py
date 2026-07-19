import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.hybrid_backtester import HybridBacktester

PARAMS = {
    # V3: Balance entre calidad y cantidad
    'V1_ORIGINAL': {
        'min_confidence': 55,
        'require_wr_confirmation': False,
        'require_trend_alignment': False,
        'avoid_hours': [],
    },
    'V2_AGGRESSIVE': {
        'min_confidence': 65,
        'require_wr_confirmation': True,
        'require_trend_alignment': True,
        'avoid_hours': [0, 7, 10, 11, 18],
    },
    'V3_BALANCE': {
        'min_confidence': 65,
        'require_wr_confirmation': False,
        'require_trend_alignment': True,
        'avoid_hours': [0, 7],
    },
    'V4_SOFT': {
        'min_confidence': 60,
        'require_wr_confirmation': False,
        'require_trend_alignment': True,
        'avoid_hours': [0],
    },
}

BASE = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
}

symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD']
bt = HybridBacktester()

print('=' * 120)
header = '  {:<15s} | {:<8s} | {:>8s} | {:>7s} | {:>6s} | {:>7s} | {:>6s} | {:>10s}'
print(header.format('Config', 'Symbol', 'Return', 'WR', 'PF', 'DD', 'Trades', 'Avg R'))
print('  ' + '-' * 105)

results_summary = []

for label, filters in PARAMS.items():
    for symbol in symbols:
        fp = f'data/{symbol}_H1.csv'
        if not os.path.exists(fp):
            continue
        df = pd.read_csv(fp, index_col=0, parse_dates=True)
        split = int(len(df) * 0.75)
        test = df.iloc[split:]

        params = {**BASE, **filters}
        r = bt.run(test, params, symbol)

        line = '  {:<15s} | {:<8s} | {:>+7.2f}% | {:>5.1f}% | {:>4.2f} | {:>5.1f}% | {:>5d} | {:>+7.2f}'
        print(line.format(label, symbol, r['total_return'], r['win_rate'],
              r['profit_factor'], r['max_drawdown'], r['total_trades'], r['avg_r']))

        results_summary.append({
            'config': label, 'symbol': symbol,
            'ret': r['total_return'], 'wr': r['win_rate'],
            'pf': r['profit_factor'], 'dd': r['max_drawdown'],
            'trades': r['total_trades'], 'avg_r': r['avg_r'],
        })

    print('  ' + '-' * 105)

print('=' * 120)

# Summary by config
print('\nRESUMEN PROMEDIO POR CONFIG:')
for label in PARAMS.keys():
    subset = [r for r in results_summary if r['config'] == label]
    if not subset:
        continue
    avg_ret = sum(r['ret'] for r in subset) / len(subset)
    avg_wr = sum(r['wr'] for r in subset) / len(subset)
    avg_pf = sum(r['pf'] for r in subset) / len(subset)
    avg_dd = sum(r['dd'] for r in subset) / len(subset)
    avg_r = sum(r['avg_r'] for r in subset) / len(subset)
    total_t = sum(r['trades'] for r in subset)
    print(f'  {label:<15s}: Ret={avg_ret:>+7.2f}%  WR={avg_wr:>5.1f}%  PF={avg_pf:.2f}  DD={avg_dd:>5.1f}%  Trades={total_t:>4d}  AvgR={avg_r:>+.2f}')
