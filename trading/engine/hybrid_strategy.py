import numpy as np
import pandas as pd

class HybridStrategy:
    def __init__(self, params=None):
        p = params or {}
        # EMA params
        self.ema_fast = p.get('ema_fast', 22)
        self.ema_slow = p.get('ema_slow', 50)
        # Williams %R params
        self.williams_period = p.get('williams_period', 14)
        self.williams_upper = p.get('williams_upperband', -20)
        self.williams_lower = p.get('williams_lowerband', -80)
        # SMC params
        self.swing_strength = p.get('swing_strength', 3)
        self.ob_volume_mult = p.get('ob_volume_mult', 1.2)
        self.fvg_min_bars = p.get('fvg_min_bars', 3)
        # Risk params
        self.sl_atr_mult = p.get('sl_atr_mult', 1.5)
        self.tp_atr_mult = p.get('tp_atr_mult', 3.0)
        self.min_rr = p.get('min_rr', 2.0)
        # Filters
        self.min_confidence = p.get('min_confidence', 65)
        self.enable_ob = p.get('enable_ob', True)
        self.enable_bos = p.get('enable_bos', True)
        self.enable_ema_w = p.get('enable_ema_w', True)
        self.atr_period = p.get('atr_period', 14)
        # Advanced filters
        self.require_wr_confirmation = p.get('require_wr_confirmation', True)
        self.require_trend_alignment = p.get('require_trend_alignment', True)
        self.avoid_hours = p.get('avoid_hours', [0, 7, 10, 11, 18])
        self.max_consecutive_losses = p.get('max_consecutive_losses', 5)
        self._loss_counter = 0

    def analyze(self, df):
        data = df.copy()

        # === INDICADORES ===
        data['ema_fast'] = data['close'].ewm(span=self.ema_fast, adjust=False).mean()
        data['ema_slow'] = data['close'].ewm(span=self.ema_slow, adjust=False).mean()
        data['trend_up'] = data['ema_fast'] > data['ema_slow']
        data['ema_diff'] = (data['ema_fast'] - data['ema_slow']) / data['ema_slow'] * 100

        high_roll = data['high'].rolling(self.williams_period)
        low_roll = data['low'].rolling(self.williams_period)
        data['williams_r'] = ((high_roll.max() - data['close']) / (high_roll.max() - low_roll.min()).replace(0, np.nan)) * -100
        data['oversold'] = data['williams_r'] < self.williams_lower
        data['overbought'] = data['williams_r'] > self.williams_upper

        data['atr'] = self._calc_atr(data, self.atr_period)

        # === ESTRUCTURA SMC ===
        data['swing_high'], data['swing_low'] = self._find_swings(data)

        data['bos_up'] = False
        data['bos_down'] = False
        data['choch_up'] = False
        data['choch_down'] = False
        self._find_bos_choch(data)

        data['ob_bullish'] = False
        data['ob_bearish'] = False
        self._find_order_blocks(data)

        data['fvg_bullish'] = False
        data['fvg_bearish'] = False
        self._find_fvg(data)

        # === SETUPS ===
        setups = []

        for i in range(self.ema_slow + self.williams_period + 10, len(data)):
            confidence = 0
            setup_type = None
            direction = None
            reasons = []

            if self.enable_ob:
                if data['ob_bullish'].iloc[i] and data['trend_up'].iloc[i]:
                    direction = 'buy'
                    setup_type = 'OB_Trend'
                    confidence = 60
                    reasons.append('OB_bullish')
                    if data.get('fvg_bullish', pd.Series(False)).iloc[i]:
                        confidence += 15
                        reasons.append('FVG_confluence')
                    if data['oversold'].iloc[i] and data['williams_r'].iloc[i] < self.williams_lower:
                        confidence += 10
                        reasons.append('oversold')

                elif data['ob_bearish'].iloc[i] and not data['trend_up'].iloc[i]:
                    direction = 'sell'
                    setup_type = 'OB_Trend'
                    confidence = 60
                    reasons.append('OB_bearish')
                    if data.get('fvg_bearish', pd.Series(False)).iloc[i]:
                        confidence += 15
                        reasons.append('FVG_confluence')
                    if data['overbought'].iloc[i] and data['williams_r'].iloc[i] > self.williams_upper:
                        confidence += 10
                        reasons.append('overbought')

            # BOS Continuation - most profitable setup, higher priority
            if self.enable_bos:
                if data['bos_up'].iloc[i] and data['trend_up'].iloc[i]:
                    new_conf = 60
                    new_reasons = ['BOS_up']
                    if data.get('fvg_bullish', pd.Series(False)).iloc[i]:
                        new_conf += 10
                        new_reasons.append('FVG')
                    if data['oversold'].iloc[i]:
                        new_conf += 8
                        new_reasons.append('oversold')
                    if data.get('choch_up', pd.Series(False)).iloc[i]:
                        new_conf += 12
                        new_reasons.append('CHoCH')

                    if direction is None or new_conf > confidence:
                        direction = 'buy'; setup_type = 'BOS_Continuation'; confidence = new_conf; reasons = new_reasons
                    elif direction == 'buy':
                        confidence = max(confidence, new_conf)
                        reasons.extend([r for r in new_reasons if r not in reasons])

                elif data['bos_down'].iloc[i] and not data['trend_up'].iloc[i]:
                    new_conf = 60
                    new_reasons = ['BOS_down']
                    if data.get('fvg_bearish', pd.Series(False)).iloc[i]:
                        new_conf += 10
                        new_reasons.append('FVG')
                    if data['overbought'].iloc[i]:
                        new_conf += 8
                        new_reasons.append('overbought')
                    if data.get('choch_down', pd.Series(False)).iloc[i]:
                        new_conf += 12
                        new_reasons.append('CHoCH')

                    if direction is None or new_conf > confidence:
                        direction = 'sell'; setup_type = 'BOS_Continuation'; confidence = new_conf; reasons = new_reasons
                    elif direction == 'sell':
                        confidence = max(confidence, new_conf)
                        reasons.extend([r for r in new_reasons if r not in reasons])

            # EMA/W%R Setup (standalone when no SMC/BOS)
            if self.enable_ema_w and direction is None:
                if data['trend_up'].iloc[i] and data['oversold'].iloc[i] and not data['trend_up'].iloc[i-1]:
                    direction = 'buy'
                    setup_type = 'EMA_Williams'
                    confidence = 40
                    reasons = ['ema_trend_up', 'oversold']
                    if data.get('choch_up', pd.Series(False)).iloc[i]:
                        confidence += 15
                        reasons.append('CHoCH')

                elif not data['trend_up'].iloc[i] and data['overbought'].iloc[i] and data['trend_up'].iloc[i-1]:
                    direction = 'sell'
                    setup_type = 'EMA_Williams'
                    confidence = 40
                    reasons = ['ema_trend_down', 'overbought']
                    if data.get('choch_down', pd.Series(False)).iloc[i]:
                        confidence += 15
                        reasons.append('CHoCH')

            if direction is not None and confidence >= self.min_confidence:
                ts = data.index[i]
                hour = ts.hour if hasattr(ts, 'hour') else 0

                # Hour filter
                if hasattr(ts, 'hour') and self.avoid_hours and ts.hour in set(self.avoid_hours):
                    direction = None; continue

                # Trend alignment filter
                if self.require_trend_alignment:
                    trend_up = data['trend_up'].iloc[i]
                    ema_diff_val = data['ema_diff'].iloc[i]
                    if direction == 'buy' and not trend_up:
                        continue
                    if direction == 'sell' and trend_up:
                        continue

                # W%R confirmation filter
                if self.require_wr_confirmation:
                    wr = data['williams_r'].iloc[i]
                    if direction == 'buy' and wr > self.williams_upper:
                        continue
                    if direction == 'sell' and wr < self.williams_lower:
                        continue

                entry = data['close'].iloc[i]
                atr = data['atr'].iloc[i]

                if direction == 'buy':
                    sl = entry - atr * self.sl_atr_mult
                    tp = entry + atr * self.tp_atr_mult
                else:
                    sl = entry + atr * self.sl_atr_mult
                    tp = entry - atr * self.tp_atr_mult

                risk = abs(entry - sl)
                reward = abs(tp - entry)
                rr = reward / risk if risk > 0 else 0

                if rr >= self.min_rr:
                    setups.append({
                        'index': i,
                        'timestamp': data.index[i],
                        'type': direction,
                        'setup_type': setup_type,
                        'confidence': round(min(confidence, 99), 1),
                        'entry': entry,
                        'sl': sl,
                        'tp': tp,
                        'rr': round(rr, 2),
                        'atr': atr,
                        'reasons': reasons,
                        'indicators': {
                            'ema_fast': data['ema_fast'].iloc[i],
                            'ema_slow': data['ema_slow'].iloc[i],
                            'williams_r': data['williams_r'].iloc[i],
                            'trend_up': bool(data['trend_up'].iloc[i]),
                        }
                    })

        return setups, data

    def _find_swings(self, data):
        swing_highs = pd.Series(False, index=data.index)
        swing_lows = pd.Series(False, index=data.index)
        s = self.swing_strength
        for i in range(s, len(data) - s):
            if all(data['high'].iloc[i] >= data['high'].iloc[i-j] for j in range(1, s+1)) and \
               all(data['high'].iloc[i] >= data['high'].iloc[i+j] for j in range(1, s+1)):
                swing_highs.iloc[i] = True
            if all(data['low'].iloc[i] <= data['low'].iloc[i-j] for j in range(1, s+1)) and \
               all(data['low'].iloc[i] <= data['low'].iloc[i+j] for j in range(1, s+1)):
                swing_lows.iloc[i] = True
        return swing_highs, swing_lows

    def _find_bos_choch(self, data):
        last_swing_high_idx = None
        last_swing_low_idx = None
        prev_swing_high_idx = None
        prev_swing_low_idx = None

        for i in range(len(data)):
            if data['swing_high'].iloc[i]:
                prev_swing_high_idx = last_swing_high_idx
                last_swing_high_idx = i
            if data['swing_low'].iloc[i]:
                prev_swing_low_idx = last_swing_low_idx
                last_swing_low_idx = i

            if last_swing_high_idx is not None and prev_swing_high_idx is not None:
                if data['high'].iloc[i] > data['high'].iloc[last_swing_high_idx]:
                    if data['high'].iloc[last_swing_high_idx] > data['high'].iloc[prev_swing_high_idx]:
                        data.loc[data.index[i], 'bos_up'] = True
                    else:
                        data.loc[data.index[i], 'choch_up'] = True

            if last_swing_low_idx is not None and prev_swing_low_idx is not None:
                if data['low'].iloc[i] < data['low'].iloc[last_swing_low_idx]:
                    if data['low'].iloc[last_swing_low_idx] < data['low'].iloc[prev_swing_low_idx]:
                        data.loc[data.index[i], 'bos_down'] = True
                    else:
                        data.loc[data.index[i], 'choch_down'] = True

    def _find_order_blocks(self, data):
        for i in range(2, len(data)):
            body_prev = abs(data['close'].iloc[i-1] - data['open'].iloc[i-1])
            range_prev = data['high'].iloc[i-1] - data['low'].iloc[i-1]
            if range_prev == 0:
                continue
            body_ratio = body_prev / range_prev

            vol_mult = 1.0
            if 'tick_volume' in data.columns and i >= 20:
                avg_vol = data['tick_volume'].iloc[i-20:i].mean()
                if avg_vol > 0:
                    vol_mult = data['tick_volume'].iloc[i-1] / avg_vol

            if body_ratio > 0.6 and vol_mult >= self.ob_volume_mult:
                if data['close'].iloc[i-1] > data['open'].iloc[i-1]:
                    if data['low'].iloc[i] <= data['low'].iloc[i-1]:
                        data.loc[data.index[i], 'ob_bullish'] = True
                else:
                    if data['high'].iloc[i] >= data['high'].iloc[i-1]:
                        data.loc[data.index[i], 'ob_bearish'] = True

    def _find_fvg(self, data):
        for i in range(self.fvg_min_bars, len(data)):
            prev_high = data['high'].iloc[i - self.fvg_min_bars]
            prev_low = data['low'].iloc[i - self.fvg_min_bars]
            curr_high = data['high'].iloc[i]
            curr_low = data['low'].iloc[i]

            if curr_low > prev_high:
                data.loc[data.index[i], 'fvg_bullish'] = True
            elif curr_high < prev_low:
                data.loc[data.index[i], 'fvg_bearish'] = True

    def _calc_atr(self, df, period=14):
        tr1 = df['high'] - df['low']
        tr2 = (df['high'] - df['close'].shift(1)).abs()
        tr3 = (df['low'] - df['close'].shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        return tr.rolling(window=period).mean()

    def get_params(self):
        return {
            'ema_fast': self.ema_fast,
            'ema_slow': self.ema_slow,
            'williams_period': self.williams_period,
            'williams_upperband': self.williams_upper,
            'williams_lowerband': self.williams_lower,
            'swing_strength': self.swing_strength,
            'ob_volume_mult': self.ob_volume_mult,
            'sl_atr_mult': self.sl_atr_mult,
            'tp_atr_mult': self.tp_atr_mult,
            'min_rr': self.min_rr,
            'min_confidence': self.min_confidence,
            'enable_ob': self.enable_ob,
            'enable_bos': self.enable_bos,
            'enable_ema_w': self.enable_ema_w,
            'require_wr_confirmation': self.require_wr_confirmation,
            'require_trend_alignment': self.require_trend_alignment,
            'avoid_hours': self.avoid_hours,
        }
