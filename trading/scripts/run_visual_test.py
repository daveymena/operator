import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.hybrid_backtester import HybridBacktester
from engine.visualizer import TradeVisualizer
from engine.neural_filter import NeuralFilter

# Best params based on testing
BOS_ONLY = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False,
    'enable_bos': True,
    'enable_ema_w': True,
}

HYBRID = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': True,
    'enable_bos': True,
    'enable_ema_w': True,
}

symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'USDCAD']
viz = TradeVisualizer()

all_results = []
for params, label in [(BOS_ONLY, 'BOS_ONLY'), (HYBRID, 'HYBRID')]:
    print(f'\n{"="*80}')
    print(f'  CONFIG: {label}')
    print(f'{"="*80}')

    bt = HybridBacktester()
    config_results = []

    for symbol in symbols:
        fp = f'data/{symbol}_H1.csv'
        if not os.path.exists(fp):
            continue
        df = pd.read_csv(fp, index_col=0, parse_dates=True)
        split = int(len(df) * 0.75)
        train = df.iloc[:split]
        test = df.iloc[split:]

        r_train = bt.run(train, params, symbol)
        r_test = bt.run(test, params, symbol)

        print(f'\n--- {symbol} ---')
        print(f'  Train: {r_train["total_return"]:+.2f}% | PF:{r_train["profit_factor"]} | WR:{r_train["win_rate"]}% | DD:{r_train["max_drawdown"]:.1f}% | Trades:{r_train["total_trades"]}')
        print(f'  Test:  {r_test["total_return"]:+.2f}% | PF:{r_test["profit_factor"]} | WR:{r_test["win_rate"]}% | DD:{r_test["max_drawdown"]:.1f}% | Trades:{r_test["total_trades"]}')

        if r_test.get('setup_stats'):
            for st, sts in r_test['setup_stats'].items():
                print(f'    {st}: Trades={sts["trades"]} WR={sts["win_rate"]}% P&L=${sts["pnl"]:+,.2f}')

        charts = viz.generate_full_report(test, r_test, f'{symbol} {label} - Test')
        viz.save_html_report(f'{symbol}_{label}', r_test, charts)
        print(f'  Reporte: data/charts/report_{symbol}_{label}.html')

        config_results.append({
            'symbol': symbol, 'config': label,
            'train_r': r_train['total_return'], 'train_pf': r_train['profit_factor'],
            'train_wr': r_train['win_rate'], 'train_dd': r_train['max_drawdown'],
            'test_r': r_test['total_return'], 'test_pf': r_test['profit_factor'],
            'test_wr': r_test['win_rate'], 'test_dd': r_test['max_drawdown'],
            'test_trades': r_test['total_trades'],
        })

    all_results.extend(config_results)

    # Summary per config
    avg_test_r = sum(r['test_r'] for r in config_results) / len(config_results)
    avg_test_pf = sum(r['test_pf'] for r in config_results) / len(config_results)
    avg_test_wr = sum(r['test_wr'] for r in config_results) / len(config_results)
    avg_test_dd = sum(r['test_dd'] for r in config_results) / len(config_results)

    print(f'\n  PROMEDIO {label}:')
    print(f'    Test Return: {avg_test_r:+.2f}% | PF: {avg_test_pf:.2f} | WR: {avg_test_wr:.1f}% | DD: {avg_test_dd:.1f}%')

# Final comparison
print(f'\n{"="*80}')
print(f'  COMPARATIVA FINAL')
print(f'{"="*80}')
header = '  {:<8s} | {:>10s} | {:>8s} | {:>7s} | {:>7s} | {:>8s} | {:>7s} | {:>7s}'
print(header.format('Symbol', 'Config', 'Test R', 'PF', 'WR', 'DD', 'Trades'))
print('  ' + '-' * 72)
for r in all_results:
    print('  {:<8s} | {:>10s} | {:>+7.2f}% | {:>6.2f} | {:>5.1f}% | {:>5.1f}% | {:>6d}'.format(
        r['symbol'], r['config'], r['test_r'], r['test_pf'], r['test_wr'], r['test_dd'], r['test_trades']))
print('  ' + '-' * 72)

bos_results = [r for r in all_results if r['config'] == 'BOS_ONLY']
hybrid_results = [r for r in all_results if r['config'] == 'HYBRID']

if bos_results and hybrid_results:
    bos_avg_r = sum(r['test_r'] for r in bos_results) / len(bos_results)
    hyb_avg_r = sum(r['test_r'] for r in hybrid_results) / len(hybrid_results)
    print(f'\n  BOS_ONLY  Avg Return: {bos_avg_r:+.2f}%')
    print(f'  HYBRID    Avg Return: {hyb_avg_r:+.2f}%')
print(f'\n  Reportes HTML en: data/charts/')
print(f'{"="*80}')
