import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.data_provider import DataProvider

dp = DataProvider()
print(f'Sources: {dp.sources}')

df = dp.get_recent_data('EURUSD', 'H1', 1)
if df is not None and len(df) > 5:
    print(f'OK: {len(df)} velas')
    print(f'Columns: {list(df.columns)}')
    print(f'Ultimo close: {df["close"].iloc[-1]:.5f}')
    print(f'Fecha: {df.index[-1]}')
else:
    print(f'Fallback: {len(df) if df is not None else 0}')
    # Try direct yfinance
    import yfinance as yf
    print('Direct yfinance test:')
    d = yf.download('EURUSD=X', period='5d', interval='1h', progress=False)
    print(f'  Shape: {d.shape}')
    print(f'  Columns: {list(d.columns)}')
    print(f'  Empty: {d.empty}')
