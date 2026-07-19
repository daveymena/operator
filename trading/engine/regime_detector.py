import numpy as np
import pandas as pd

class RegimeDetector:
    def __init__(self, atr_period=14, bb_period=20, bb_std=2.0, trend_period=14):
        self.atr_period = atr_period
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.trend_period = trend_period

    def analyze(self, df):
        data = df.copy()
        result = {}

        atr = self._calc_atr(data)
        result['atr'] = atr
        result['current_atr'] = atr.iloc[-1] if len(atr) > 0 else 0

        atr_percentile = atr.rank(pct=True).iloc[-1] * 100 if len(atr) > 0 else 50
        result['atr_percentile'] = round(atr_percentile, 1)

        if atr_percentile > 80:
            result['volatility'] = 'high'
        elif atr_percentile < 20:
            result['volatility'] = 'low'
        else:
            result['volatility'] = 'normal'

        sma = data['close'].rolling(self.bb_period).mean()
        std = data['close'].rolling(self.bb_period).std()
        bb_width = ((sma + self.bb_std * std) - (sma - self.bb_std * std)) / sma * 100
        result['bb_width'] = round(bb_width.iloc[-1], 4) if len(bb_width) > 0 else 0

        up_count = 0
        down_count = 0
        recent = data.tail(self.trend_period)
        for i in range(1, len(recent)):
            if recent['close'].iloc[i] > recent['close'].iloc[i-1]:
                up_count += 1
            else:
                down_count += 1

        total = up_count + down_count
        trend_strength = max(up_count, down_count) / total * 100 if total > 0 else 50
        result['trend_strength'] = round(trend_strength, 1)

        ema_short = data['close'].ewm(span=10, adjust=False).mean()
        ema_long = data['close'].ewm(span=50, adjust=False).mean()
        ema_diff_pct = (ema_short - ema_long) / ema_long * 100
        result['ema_trend'] = round(ema_diff_pct.iloc[-1], 4) if len(ema_diff_pct) > 0 else 0

        if trend_strength > 65 and ema_diff_pct.iloc[-1] > 0.1 if len(ema_diff_pct) > 0 else False:
            result['regime'] = 'trending_up'
        elif trend_strength > 65 and ema_diff_pct.iloc[-1] < -0.1 if len(ema_diff_pct) > 0 else False:
            result['regime'] = 'trending_down'
        elif result['volatility'] == 'high':
            result['regime'] = 'volatile'
        elif result['volatility'] == 'low':
            result['regime'] = 'low_volatility'
        else:
            result['regime'] = 'ranging'

        recommendations = {
            'trending_up': {
                'position_multiplier': 1.2,
                'min_confidence': 55,
                'preferred_setups': ['buy', 'retest'],
                'avoid_setups': ['counter_trend'],
                'max_spread': 2.5,
            },
            'trending_down': {
                'position_multiplier': 1.2,
                'min_confidence': 55,
                'preferred_setups': ['sell', 'retest'],
                'avoid_setups': ['counter_trend'],
                'max_spread': 2.5,
            },
            'ranging': {
                'position_multiplier': 0.8,
                'min_confidence': 70,
                'preferred_setups': ['buy', 'sell'],
                'avoid_setups': ['breakout'],
                'max_spread': 2.0,
            },
            'volatile': {
                'position_multiplier': 0.5,
                'min_confidence': 80,
                'preferred_setups': ['buy', 'sell'],
                'avoid_setups': ['breakout', 'retest'],
                'max_spread': 1.5,
            },
            'low_volatility': {
                'position_multiplier': 1.0,
                'min_confidence': 65,
                'preferred_setups': ['buy', 'sell'],
                'avoid_setups': [],
                'max_spread': 3.0,
            },
        }

        result['recommendation'] = recommendations.get(result['regime'], recommendations['ranging'])

        return result

    def _calc_atr(self, df, period=None):
        period = period or self.atr_period
        high, low = df['high'], df['low']
        close_prev = df['close'].shift(1)
        tr1 = high - low
        tr2 = (high - close_prev).abs()
        tr3 = (low - close_prev).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period).mean()
