import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from engine.hybrid_strategy import HybridStrategy

df = pd.read_csv('data/EURUSD_H1.csv', index_col=0, parse_dates=True).tail(2000)
params = {
    'ema_fast': 10, 'ema_slow': 30,
    'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
    'swing_strength': 2, 'ob_volume_mult': 1.0,
    'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 1.5,
    'min_confidence': 30,
}
strat = HybridStrategy(params)
setups, data = strat.analyze(df)
print('Setups detectados:', len(setups))
for s in setups[:10]:
    print(f'  {s["timestamp"]} | {s["type"]:4s} | {s["setup_type"]:20s} | conf: {s["confidence"]} | RR: {s["rr"]}')
if len(setups) == 0:
    print('DEBUG:')
    print(f'  trend_up sum: {data["trend_up"].sum()}')
    print(f'  oversold sum: {data["oversold"].sum()}')
    print(f'  overbought sum: {data["overbought"].sum()}')
    print(f'  ob_bullish sum: {data["ob_bullish"].sum()}')
    print(f'  ob_bearish sum: {data["ob_bearish"].sum()}')
    print(f'  fvg_bullish sum: {data["fvg_bullish"].sum()}')
    print(f'  fvg_bearish sum: {data["fvg_bearish"].sum()}')
    print(f'  bos_up sum: {data["bos_up"].sum()}')
    print(f'  bos_down sum: {data["bos_down"].sum()}')
    print(f'  choch_up sum: {data["choch_up"].sum()}')
    print(f'  choch_down sum: {data["choch_down"].sum()}')
