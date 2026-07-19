import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.hybrid_backtester import HybridBacktester

symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY']

params = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 50,
}

bt = HybridBacktester()

all_results = []
for symbol in symbols:
    filepath = f'data/{symbol}_H1.csv'
    if not os.path.exists(filepath):
        print(f'  Datos no encontrados: {symbol}')
        continue

    df = pd.read_csv(filepath, index_col=0, parse_dates=True)
    split = int(len(df) * 0.75)
    train = df.iloc[:split]
    test = df.iloc[split:]

    print(f'\n=== {symbol} ===')
    r_train = bt.run(train, params, symbol)
    r_test = bt.run(test, params, symbol)

    print('TRAIN:')
    bt.print_report(r_train)
    print('TEST:')
    bt.print_report(r_test)

    all_results.append({
        'symbol': symbol,
        'train_return': r_train['total_return'],
        'train_pf': r_train['profit_factor'],
        'train_wr': r_train['win_rate'],
        'train_dd': r_train['max_drawdown'],
        'train_trades': r_train['total_trades'],
        'test_return': r_test['total_return'],
        'test_pf': r_test['profit_factor'],
        'test_wr': r_test['win_rate'],
        'test_dd': r_test['max_drawdown'],
        'test_trades': r_test['total_trades'],
    })

print('\n\n' + '=' * 80)
print('  RESUMEN GENERAL')
print('=' * 80)
header = '  {:<8s} | {:>8s} | {:>8s} | {:>8s} | {:>8s} | {:>8s} | {:>8s} | {:>7s}'.format(
    'Symbol', 'Train R', 'Train PF', 'Train WR', 'Test R', 'Test PF', 'Test WR', 'Test DD')
print(header)
print('-' * 80)
for r in all_results:
    line = '  {:<8s} | {:>+7.2f}% | {:>7.2f} | {:>6.1f}% | {:>+7.2f}% | {:>7.2f} | {:>6.1f}% | {:>6.2f}%'.format(
        r['symbol'], r['train_return'], r['train_pf'], r['train_wr'],
        r['test_return'], r['test_pf'], r['test_wr'], r['test_dd'])
    print(line)

avg_train_r = sum(r['train_return'] for r in all_results) / len(all_results)
avg_test_r = sum(r['test_return'] for r in all_results) / len(all_results)
print('-' * 80)
promedio_line = '  {:<8s} | {:>+7.2f}% | {:>8s} | {:>8s} | {:>+7.2f}%'.format('PROMEDIO', avg_train_r, '', '', avg_test_r)
print(promedio_line)
print('=' * 80)
