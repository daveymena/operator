import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT_PARAMS = {
    'ema_fast': 22,
    'ema_slow': 35,
    'williams_period': 14,
    'williams_upperband': -20,
    'williams_lowerband': -80,
    'stoploss': 150,
    'takeprofit': 150,
}

OPTIMIZATION_RANGES = {
    'ema_fast': [5, 50],
    'ema_slow': [20, 100],
    'williams_period': [3, 30],
    'williams_upperband': [-40, -5],
    'williams_lowerband': [-95, -60],
    'stoploss': [50, 500],
    'takeprofit': [50, 1000],
}

SYMBOLS = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF']

TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

PIP_VALUES = {
    'EURUSD': 10.0, 'GBPUSD': 10.0, 'AUDUSD': 10.0,
    'NZDUSD': 10.0, 'USDJPY': 9.5, 'USDCAD': 8.0,
    'USDCHF': 9.0, 'XAUUSD': 1.0, 'XAGUSD': 0.5,
}

INITIAL_CAPITAL = 100000.0
DEFAULT_LEVERAGE = 3
DEFAULT_COMMISSION = 5.0
