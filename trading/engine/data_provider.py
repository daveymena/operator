import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

class DataProvider:
    def __init__(self):
        self.sources = {}
        self._init_yfinance()

    def _init_yfinance(self):
        try:
            import yfinance as yf
            self.yf = yf
            self.sources['yfinance'] = True
        except ImportError:
            self.sources['yfinance'] = False

    @staticmethod
    def _yf_symbol(symbol):
        mapping = {
            'EURUSD': 'EURUSD=X', 'GBPUSD': 'GBPUSD=X',
            'AUDUSD': 'AUDUSD=X', 'NZDUSD': 'NZDUSD=X',
            'USDJPY': 'USDJPY=X', 'USDCAD': 'USDCAD=X',
            'USDCHF': 'USDCHF=X', 'XAUUSD': 'GC=F',
            'XAGUSD': 'SI=F', 'US30': 'YM=F',
            'SP500': 'ES=F', 'NAS100': 'NQ=F',
        }
        return mapping.get(symbol, symbol + '=X')

    @staticmethod
    def _timeframe_map(tf):
        mapping = {
            '1m': '1m', '5m': '5m', '15m': '15m',
            '30m': '30m', '1h': '1h', 'H1': '1h',
            '4h': '4h', 'H4': '4h', '1d': '1d',
            'D1': '1d', '1w': '1wk', 'W1': '1wk',
        }
        return mapping.get(tf, '1h')

    def get_historical_data(self, symbol='EURUSD', timeframe='H1', years=2):
        if not self.sources.get('yfinance'):
            return self._generate_synthetic(symbol, years, timeframe)

        interval = self._timeframe_map(timeframe)
        max_days = 730 if interval in ['1m','5m','15m','30m','1h'] else 9999
        days = min(years * 365, max_days)
        period = f'{max(days, 30)}d'

        try:
            ticker = self._yf_symbol(symbol)
            df = self.yf.download(ticker, period=period, interval=interval, progress=False)

            if df.empty or len(df) < 100:
                shorter = f'{max(days // 2, 30)}d'
                df = self.yf.download(ticker, period=shorter, interval=interval, progress=False)

            if df.empty or len(df) < 50:
                return self._generate_synthetic(symbol, years, timeframe)

            flat_cols = []
            for c in df.columns:
                if isinstance(c, tuple):
                    flat_cols.append(str(c[0]).lower())
                else:
                    flat_cols.append(str(c).lower())
            df.columns = flat_cols

            rename_map = {'open': 'open', 'high': 'high', 'low': 'low',
                          'close': 'close', 'volume': 'tick_volume'}
            df.rename(columns=rename_map, inplace=True)

            df.index.name = 'timestamp'
            df['spread'] = 0.0002
            df['tick_volume'] = df['tick_volume'].fillna(1000).astype(int)
            df.dropna(inplace=True)
            return df

        except Exception as e:
            print(f'  Error downloading {symbol}: {e}')
            return self._generate_synthetic(symbol, years, timeframe)

    def get_recent_data(self, symbol='EURUSD', timeframe='H1', days=5):
        if not self.sources.get('yfinance'):
            return self._generate_synthetic(symbol, 1, timeframe)

        interval = self._timeframe_map(timeframe)
        period = f'{max(days, 5)}d'

        try:
            ticker = self._yf_symbol(symbol)
            df = self.yf.download(ticker, period=period, interval=interval, progress=False)

            if df.empty:
                return None

            flat_cols = []
            for c in df.columns:
                if isinstance(c, tuple):
                    flat_cols.append(str(c[0]).lower())
                else:
                    flat_cols.append(str(c).lower())
            df.columns = flat_cols

            df.rename(columns={'volume': 'tick_volume'}, inplace=True)
            df.index.name = 'timestamp'
            df['spread'] = 0.0002
            df['tick_volume'] = df['tick_volume'].fillna(1000).astype(int)
            return df

        except Exception as e:
            print(f'  Error: {e}')
            return None

    def get_all_symbols_data(self, symbols=None, timeframe='H1', years=2):
        if symbols is None:
            from .config import SYMBOLS
            symbols = SYMBOLS

        result = {}
        for symbol in symbols:
            print(f'  Descargando {symbol}...')
            df = self.get_historical_data(symbol, timeframe, years)
            result[symbol] = df
            print(f'    {len(df)} velas')

        return result

    def save_all_data(self, data_dir=None, symbols=None, timeframe='H1', years=2):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
        os.makedirs(data_dir, exist_ok=True)

        all_data = self.get_all_symbols_data(symbols, timeframe, years)

        for symbol, df in all_data.items():
            filepath = os.path.join(data_dir, f'{symbol}_{timeframe}.csv')
            df.to_csv(filepath)

        return all_data

    @staticmethod
    def _generate_synthetic(symbol='EURUSD', years=2, timeframe='H1'):
        freq_map = {'1m': '1min', '5m': '5min', '15m': '15min',
                    '30m': '30min', 'H1': 'h', '4h': '4h', 'D1': 'd'}
        freq = freq_map.get(timeframe, 'h')
        days = years * 365
        periods = days * 24 if 'h' in freq else days * 24 * 2

        start = datetime.now() - timedelta(days=days)
        dates = pd.date_range(start=start, periods=periods, freq=freq)

        np.random.seed(hash(symbol) % 2**32)
        returns = np.random.normal(0.00005, 0.0005, periods)
        price = 1.1000
        prices = []
        for r in returns:
            price *= (1 + r)
            prices.append(price)

        df = pd.DataFrame(index=dates)
        df['close'] = prices
        df['open'] = df['close'].shift(1) * (1 + np.random.normal(0, 0.0002, periods))
        df['high'] = df[['open', 'close']].max(axis=1) * (1 + abs(np.random.normal(0, 0.0003, periods)))
        df['low'] = df[['open', 'close']].min(axis=1) * (1 - abs(np.random.normal(0, 0.0003, periods)))
        df['tick_volume'] = np.random.randint(100, 5000, periods)
        df['spread'] = np.random.uniform(0.0001, 0.0003, periods)
        df.index.name = 'timestamp'
        df.iloc[0, 0] = prices[0]
        df.dropna(inplace=True)
        return df
