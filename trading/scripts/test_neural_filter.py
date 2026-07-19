import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from engine.hybrid_backtester import HybridBacktester
from engine.neural_filter import NeuralFilter
from engine.config import SYMBOLS, OPTIMIZATION_RANGES

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

symbols_to_test = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD']

print('=' * 80)
print('  TEST: NEURAL FILTER SOBRE BOS_ONLY')
print('=' * 80)

for symbol in symbols_to_test:
    fp = f'data/{symbol}_H1.csv'
    if not os.path.exists(fp):
        continue

    df = pd.read_csv(fp, index_col=0, parse_dates=True)
    split = int(len(df) * 0.75)
    train_df = df.iloc[:split]
    test_df = df.iloc[split:]

    print(f'\n--- {symbol} ---')

    bt = HybridBacktester()
    bt.capital = 100000
    train_r = bt.run(train_df, BOS_PARAMS, symbol)

    # Train neural filter on TRAIN data
    nf = NeuralFilter()
    combined = pd.concat([train_df])
    report = nf.train(combined, BOS_PARAMS, balance=True)

    if report:
        print(f'  NN Train acc: {report["train_accuracy"]}% | Test acc: {report["test_accuracy"]}%')
    else:
        print(f'  NN: No se pudo entrenar (pocos datos)')
        continue

    # Apply filter to TEST data - only take trades where NN predicts win
    bt2 = HybridBacktester()
    bt2.capital = 100000
    test_setups = bt2.run(test_df, BOS_PARAMS, symbol)
    test_trades = test_setups['trades']

    if len(test_trades) == 0:
        print('  0 trades en test')
        continue

    # Filter trades with NN
    nn_accepted = []
    nn_rejected = []
    for t in test_trades:
        idx = test_df.index.get_loc(t['entry_time']) if t['entry_time'] in test_df.index else -1
        if idx < 10:
            nn_accepted.append(t)
            continue
        lookback = test_df.iloc[max(0, idx-200):idx+1].copy()
        if len(lookback) < 50:
            nn_accepted.append(t)
            continue
        try:
            pred = nf.predict(lookback, BOS_PARAMS)
            if pred and pred['prediction'] == 1:
                nn_accepted.append(t)
            else:
                nn_rejected.append(t)
        except:
            nn_accepted.append(t)

    # Calculate stats for filtered
    if nn_accepted:
        final_cap = 100000 + sum(t['net_pnl'] for t in nn_accepted)
        ret = (final_cap - 100000) / 100000 * 100
        wins = sum(1 for t in nn_accepted if t['net_pnl'] > 0)
        wr = wins / len(nn_accepted) * 100 if nn_accepted else 0
        gross_wins = sum(t['net_pnl'] for t in nn_accepted if t['net_pnl'] > 0)
        gross_losses = abs(sum(t['net_pnl'] for t in nn_accepted if t['net_pnl'] <= 0))
        pf = gross_wins / gross_losses if gross_losses > 0 else 99
        peak = 100000
        dd = 0
        cap = 100000
        for t in nn_accepted:
            cap += t['net_pnl']
            peak = max(peak, cap)
            dd = max(dd, (peak - cap) / peak * 100)
    else:
        ret, wr, pf, dd = 0, 0, 0, 0

    # Original stats
    orig_ret = test_setups['total_return']
    orig_wr = test_setups['win_rate']
    orig_pf = test_setups['profit_factor']
    orig_dd = test_setups['max_drawdown']

    print(f'  Original:    Return={orig_ret:>+7.2f}%  WR={orig_wr:>5.1f}%  PF={orig_pf:.2f}  DD={orig_dd:.1f}%  Trades={test_setups["total_trades"]}')
    print(f'  +NN Filter:  Return={ret:>+7.2f}%  WR={wr:>5.1f}%  PF={pf:.2f}  DD={dd:.1f}%  Trades={len(nn_accepted)}')
    print(f'  Rechazados por NN: {len(nn_rejected)} trades')

    # Save model
    model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
    os.makedirs(model_dir, exist_ok=True)
    nf.save(os.path.join(model_dir, f'neural_filter_{symbol}.pkl'))

print(f'\n{"="*80}')
print('  COMPLETADO - Modelos guardados en trading/models/')
print(f'{"="*80}')
