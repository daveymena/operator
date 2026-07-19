import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from engine.hybrid_backtester import HybridBacktester
from engine.hybrid_strategy import HybridStrategy

BOS_PARAMS = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 55,
    'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
}

symbol = 'EURUSD'
df = pd.read_csv(f'data/{symbol}_H1.csv', index_col=0, parse_dates=True)
split = int(len(df) * 0.75)
test_df = df.iloc[split:]

bt = HybridBacktester()
results = bt.run(test_df, BOS_PARAMS, symbol)
trades = results['trades']

wins = [t for t in trades if t['net_pnl'] > 0]
losses = [t for t in trades if t['net_pnl'] <= 0]

print('=' * 80)
print(f'  DIAGNOSTICO DE PERDIDAS - {symbol}')
print(f'  Total: {len(trades)} | Wins: {len(wins)} | Losses: {len(losses)}')
print(f'  Win Rate: {len(wins)/len(trades)*100:.1f}%')
print(f'  Avg Win: ${np.mean([t["net_pnl"] for t in wins]):.2f}')
print(f'  Avg Loss: ${np.mean([t["net_pnl"] for t in losses]):.2f}')
print('=' * 80)

# 1. POR MES
print('\n1. RENDIMIENTO POR MES:')
monthly = {}
for t in trades:
    m = pd.Timestamp(t['entry_time']).strftime('%Y-%m')
    if m not in monthly:
        monthly[m] = {'trades': 0, 'wins': 0, 'pnl': 0}
    monthly[m]['trades'] += 1
    monthly[m]['pnl'] += t['net_pnl']
    if t['net_pnl'] > 0:
        monthly[m]['wins'] += 1

for m in sorted(monthly.keys()):
    d = monthly[m]
    wr = d['wins'] / d['trades'] * 100 if d['trades'] > 0 else 0
    marker = '✅' if d['pnl'] > 0 else '❌'
    print(f'  {m}: {marker} Trades={d["trades"]:3d} WR={wr:5.1f}% P&L=${d["pnl"]:+,.2f}')

# 2. POR DIA DE SEMANA
print('\n2. RENDIMIENTO POR DIA DE SEMANA:')
weekdays = {i: {'trades': 0, 'wins': 0, 'pnl': 0} for i in range(7)}
names = ['Lunes', 'Martes', 'Mierc', 'Jueves', 'Viernes', 'Sab', 'Dom']
for t in trades:
    d = pd.Timestamp(t['entry_time']).dayofweek
    weekdays[d]['trades'] += 1
    weekdays[d]['pnl'] += t['net_pnl']
    if t['net_pnl'] > 0:
        weekdays[d]['wins'] += 1
for d in range(5):
    w = weekdays[d]
    wr = w['wins'] / w['trades'] * 100 if w['trades'] > 0 else 0
    marker = '✅' if w['pnl'] > 0 else '❌'
    print(f'  {names[d]}: {marker} Trades={w["trades"]:3d} WR={wr:5.1f}% P&L=${w["pnl"]:+,.2f}')

# 3. POR HORA
print('\n3. RENDIMIENTO POR HORA (UTC):')
hours = {h: {'trades': 0, 'wins': 0, 'pnl': 0} for h in range(24)}
for t in trades:
    h = pd.Timestamp(t['entry_time']).hour
    hours[h]['trades'] += 1
    hours[h]['pnl'] += t['net_pnl']
    if t['net_pnl'] > 0:
        hours[h]['wins'] += 1

print('  Hora  Trades   WR%     P&L     ')
for h in range(24):
    hr = hours[h]
    if hr['trades'] > 0:
        wr = hr['wins'] / hr['trades'] * 100
        m = '✅' if hr['pnl'] > 0 else '❌'
        print(f'  {h:02d}:00  {hr["trades"]:4d}   {wr:5.1f}%  {m} ${hr["pnl"]:+,.2f}')

# 4. POR RANGO DE CONFIANZA
print('\n4. RENDIMIENTO POR NIVEL DE CONFIANZA:')
conf_ranges = [(55, 65), (65, 75), (75, 85), (85, 100)]
for lo, hi in conf_ranges:
    subset = [t for t in trades if lo <= t['confidence'] < hi]
    if not subset:
        continue
    sw = sum(1 for t in subset if t['net_pnl'] > 0)
    sp = sum(t['net_pnl'] for t in subset)
    wr = sw / len(subset) * 100
    m = '✅' if sp > 0 else '❌'
    print(f'  Conf {lo}-{hi}:  Trades={len(subset):4d}  WR={wr:5.1f}%  P&L=${sp:+,.2f}')

# 5. POR EXIT REASON
print('\n5. RESULTADO POR MOTIVO DE SALIDA:')
reasons = {}
for t in trades:
    r = t.get('exit_reason', 'unknown')
    if r not in reasons:
        reasons[r] = {'trades': 0, 'wins': 0, 'pnl': 0}
    reasons[r]['trades'] += 1
    reasons[r]['pnl'] += t['net_pnl']
    if t['net_pnl'] > 0:
        reasons[r]['wins'] += 1
for r, d in sorted(reasons.items()):
    wr = d['wins'] / d['trades'] * 100
    m = '✅' if d['pnl'] > 0 else '❌'
    print(f'  {r}: {m} Trades={d["trades"]:4d} WR={wr:5.1f}% P&L=${d["pnl"]:+,.2f}')

# 6. POR RANGO DE RR
print('\n6. RENDIMIENTO POR R:R (reward:risk):')
rr_ranges = [(1.5, 2.0), (2.0, 2.5), (2.5, 3.0), (3.0, 5.0)]
for lo, hi in rr_ranges:
    subset = [t for t in trades if lo <= t.get('rr', 0) < hi]
    if not subset:
        continue
    sw = sum(1 for t in subset if t['net_pnl'] > 0)
    sp = sum(t['net_pnl'] for t in subset)
    wr = sw / len(subset) * 100
    m = '✅' if sp > 0 else '❌'
    print(f'  RR {lo}-{hi}:  Trades={len(subset):4d}  WR={wr:5.1f}%  P&L=${sp:+,.2f}')

# 7. ANALISIS DE PERDIDAS CONSECUTIVAS
print('\n7. RACHA DE PERDIDAS CONSECUTIVAS:')
max_streak = 0
current_streak = 0
streak_start = None
for t in trades:
    if t['net_pnl'] <= 0:
        current_streak += 1
        if current_streak == 1:
            streak_start = t['entry_time']
        if current_streak > max_streak:
            max_streak = current_streak
            max_streak_end = t['entry_time']
            max_streak_start = streak_start
    else:
        if current_streak > 3:
            total_lost = 0
            # need to look back
        current_streak = 0

print(f'  Max racha de perdidas: {max_streak} trades')

# Find worst losing streaks
i = 0
streaks = []
while i < len(trades):
    if trades[i]['net_pnl'] <= 0:
        streak_len = 1
        streak_pnl = trades[i]['net_pnl']
        streak_start_idx = i
        i += 1
        while i < len(trades) and trades[i]['net_pnl'] <= 0:
            streak_len += 1
            streak_pnl += trades[i]['net_pnl']
            i += 1
        streaks.append((streak_len, streak_pnl, streak_start_idx))
    else:
        i += 1

streaks.sort(key=lambda x: x[1])  # worst first
print(f'  Peores rachas:')
for slen, spnl, sidx in streaks[:5]:
    start = trades[sidx]['entry_time']
    print(f'    {slen} perdidas consecutivas: ${spnl:,.2f} desde {start}')

# 8. REVISAR CONDICIONES DE MERCADO EN PERDIDAS
print('\n8. ANALISIS DE CONDICIONES EN TRADES PERDEDORES:')
strat = HybridStrategy(BOS_PARAMS)
_, data = strat.analyze(test_df)

for condition, col, expected in [
    ('En tendencia bajista (EMA)', 'trend_up', False),
    ('Alta volatilidad (ATR > media*1.5)', None, None),
    ('Williams R en sobrecompra', 'overbought', True),
    ('Williams R en sobreventa', 'oversold', True),
]:
    matching_losses = 0
    total_losses = len(losses)
    for t in losses:
        if t['entry_time'] in data.index:
            idx = data.index.get_loc(t['entry_time'])
            row = data.iloc[idx]
            if condition == 'Alta volatilidad (ATR > media*1.5)':
                atr_mean = data['atr'].mean()
                if row['atr'] > atr_mean * 1.5:
                    matching_losses += 1
            elif col and row.get(col, False) == expected:
                matching_losses += 1
    pct = matching_losses / total_losses * 100 if total_losses > 0 else 0
    print(f'  {condition}: {matching_losses}/{total_losses} ({pct:.1f}%)')

# 9. ANALISIS POR TAMAÑO DE VELA (IMPULSIVIDAD)
print('\n9. PERDIDAS POR TAMAÑO DE VELA DE ENTRADA:')
for t in losses[:20]:
    if t['entry_time'] in data.index:
        idx = data.index.get_loc(t['entry_time'])
        row = data.iloc[idx]
        body = abs(row['close'] - row['open'])
        range_v = row['high'] - row['low']
        body_pct = body / range_v * 100 if range_v > 0 else 0
        print(f'  {t["entry_time"]} | P&L: ${t["net_pnl"]:+,.2f} | Body:{body_pct:.0f}% | ATR:{row["atr"]:.5f} | W%R:{row["williams_r"]:.0f} | Conf:{t["confidence"]}')

print(f'\n{"="*80}')
print('  DIAGNOSTICO COMPLETADO')
print(f'{"="*80}')
