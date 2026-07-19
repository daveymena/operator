import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.hybrid_backtester import HybridBacktester
from engine.visualizer import TradeVisualizer

V2_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 65,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
    'require_wr_confirmation': True,
    'require_trend_alignment': True,
    'avoid_hours': [0, 7, 10, 11, 18],
}

V1_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
    'require_wr_confirmation': False,
    'require_trend_alignment': False,
    'avoid_hours': [],
}

symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD']
viz = TradeVisualizer()

for label, params in [('V1_ORIGINAL', V1_PARAMS), ('V2_CORREGIDO', V2_PARAMS)]:
    print(f'\n{"="*80}')
    print(f'  {label}')
    print(f'{"="*80}')

    bt = HybridBacktester()
    results_list = []

    for symbol in symbols:
        fp = f'data/{symbol}_H1.csv'
        if not os.path.exists(fp):
            continue
        df = pd.read_csv(fp, index_col=0, parse_dates=True)
        split = int(len(df) * 0.75)
        test = df.iloc[split:]

        r = bt.run(test, params, symbol)

        print(f'\n  {symbol}: Return={r["total_return"]:+.2f}%  WR={r["win_rate"]:.1f}%  PF={r["profit_factor"]}  DD={r["max_drawdown"]:.1f}%  Trades={r["total_trades"]}')
        for st, sts in r.get('setup_stats', {}).items():
            print(f'    {st}: Trades={sts["trades"]} WR={sts["win_rate"]}% P&L=${sts["pnl"]:+,.2f}')

        charts = viz.generate_full_report(test, r, f'{symbol} {label}')
        viz.save_html_report(f'{symbol}_{label}', r, charts)

        results_list.append({
            'symbol': symbol,
            'ret': r['total_return'], 'pf': r['profit_factor'],
            'wr': r['win_rate'], 'dd': r['max_drawdown'],
            'trades': r['total_trades'],
        })

    avg_ret = sum(r['ret'] for r in results_list) / len(results_list)
    avg_wr = sum(r['wr'] for r in results_list) / len(results_list)
    avg_pf = sum(r['pf'] for r in results_list) / len(results_list)
    avg_dd = sum(r['dd'] for r in results_list) / len(results_list)
    total_trades = sum(r['trades'] for r in results_list)
    print(f'\n  PROMEDIO {label}: Return={avg_ret:+.2f}%  WR={avg_wr:.1f}%  PF={avg_pf:.2f}  DD={avg_dd:.1f}%  Trades={total_trades}')
