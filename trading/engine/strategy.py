import numpy as np
import pandas as pd

class EmaWilliamsStrategy:
    def __init__(self, params=None):
        p = params or {}
        self.ema_fast = p.get('ema_fast', 22)
        self.ema_slow = p.get('ema_slow', 35)
        self.williams_period = p.get('williams_period', 14)
        self.williams_upperband = p.get('williams_upperband', -20)
        self.williams_lowerband = p.get('williams_lowerband', -80)
        self.stoploss = p.get('stoploss', 150)
        self.takeprofit = p.get('takeprofit', 150)

    def calculate_indicators(self, df):
        result = df.copy()
        result['ema_fast'] = result['close'].ewm(span=self.ema_fast, adjust=False).mean()
        result['ema_slow'] = result['close'].ewm(span=self.ema_slow, adjust=False).mean()

        high_roll = result['high'].rolling(window=self.williams_period)
        low_roll = result['low'].rolling(window=self.williams_period)
        highest_high = high_roll.max()
        lowest_low = low_roll.min()

        denominator = (highest_high - lowest_low)
        denominator = denominator.replace(0, np.nan)
        result['williams_r'] = ((highest_high - result['close']) / denominator) * -100

        result['trend_up'] = result['ema_fast'] > result['ema_slow']
        result['oversold'] = result['williams_r'] < self.williams_lowerband
        result['overbought'] = result['williams_r'] > self.williams_upperband
        result['buy_signal'] = result['trend_up'] & result['oversold']
        result['sell_signal'] = (~result['trend_up']) & result['overbought']

        return result

    def generate_signals(self, df):
        data = self.calculate_indicators(df)
        signals = []
        for i in range(1, len(data)):
            if data['buy_signal'].iloc[i] and not data['buy_signal'].iloc[i-1]:
                entry_price = data['close'].iloc[i]
                signals.append({
                    'index': i,
                    'timestamp': data.index[i] if hasattr(data.index, '__getitem__') else i,
                    'type': 'buy',
                    'entry': entry_price,
                    'sl': entry_price - self.stoploss * 0.0001,
                    'tp': entry_price + self.takeprofit * 0.0001,
                    'indicators': {
                        'ema_fast': data['ema_fast'].iloc[i],
                        'ema_slow': data['ema_slow'].iloc[i],
                        'williams_r': data['williams_r'].iloc[i],
                    }
                })
            elif data['sell_signal'].iloc[i] and not data['sell_signal'].iloc[i-1]:
                entry_price = data['close'].iloc[i]
                signals.append({
                    'index': i,
                    'timestamp': data.index[i] if hasattr(data.index, '__getitem__') else i,
                    'type': 'sell',
                    'entry': entry_price,
                    'sl': entry_price + self.stoploss * 0.0001,
                    'tp': entry_price - self.takeprofit * 0.0001,
                    'indicators': {
                        'ema_fast': data['ema_fast'].iloc[i],
                        'ema_slow': data['ema_slow'].iloc[i],
                        'williams_r': data['williams_r'].iloc[i],
                    }
                })
        return signals, data

    def get_params_dict(self):
        return {
            'ema_fast': self.ema_fast,
            'ema_slow': self.ema_slow,
            'williams_period': self.williams_period,
            'williams_upperband': self.williams_upperband,
            'williams_lowerband': self.williams_lowerband,
            'stoploss': self.stoploss,
            'takeprofit': self.takeprofit,
        }
