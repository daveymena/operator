import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import yfinance as yf
import pandas as pd

# Direct test like DataProvider does
ticker = 'EURUSD=X'
interval = '1h'
period = '730d'

print(f'Downloading {ticker}, period={period}, interval={interval}')
df = yf.download(ticker, period=period, interval=interval, progress=False)
print(f'Shape: {df.shape}')
print(f'Empty: {df.empty}')
print(f'Columns raw: {list(df.columns)}')

if not df.empty:
    # Flatten columns
    flat_cols = []
    for c in df.columns:
        if isinstance(c, tuple):
            flat_cols.append(str(c[0]).lower())
        else:
            flat_cols.append(str(c).lower())
    df.columns = flat_cols
    print(f'Flat columns: {list(df.columns)}')

    rename_map = {'open': 'open', 'high': 'high', 'low': 'low',
                  'close': 'close', 'volume': 'tick_volume'}
    df.rename(columns=rename_map, inplace=True)
    print(f'Renamed columns: {list(df.columns)}')

    print(f'Close column exists: {"close" in df.columns}')
    print(f'First close: {df["close"].iloc[0]:.5f}')
    print(f'Len: {len(df)}')
