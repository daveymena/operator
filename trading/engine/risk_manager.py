import json
import os
from datetime import datetime, date
from .config import PIP_VALUES

class RiskManager:
    def __init__(self, state_file=None):
        self.state_file = state_file or os.path.join(os.path.dirname(__file__), '..', 'data', 'risk_state.json')
        self.state = self._load_state()

    def _load_state(self):
        try:
            with open(self.state_file) as f:
                return json.load(f)
        except:
            return {
                'daily_pnl': 0.0,
                'weekly_pnl': 0.0,
                'consecutive_losses': 0,
                'consecutive_wins': 0,
                'last_reset_date': str(date.today()),
                'last_week_reset': str(date.today()),
                'total_trades_today': 0,
                'mode': 'normal',
            }

    def _save_state(self):
        os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)

    def check_and_reset_daily(self):
        today = str(date.today())
        if self.state['last_reset_date'] != today:
            self.state['daily_pnl'] = 0.0
            self.state['total_trades_today'] = 0
            self.state['last_reset_date'] = today
            self._save_state()

    def check_and_reset_weekly(self):
        today = date.today()
        last = datetime.strptime(self.state['last_week_reset'], '%Y-%m-%d').date() if self.state['last_week_reset'] else today
        if (today - last).days >= 7:
            self.state['weekly_pnl'] = 0.0
            self.state['last_week_reset'] = str(today)
            self._save_state()

    def validate_trade(self, setup, balance, symbol='EURUSD'):
        self.check_and_reset_daily()
        self.check_and_reset_weekly()

        if self.state['mode'] == 'halted_24h':
            return {'valid': False, 'reason': 'Halted 24h (daily loss limit)'}
        if self.state['mode'] == 'halted_72h':
            return {'valid': False, 'reason': 'Halted 72h (weekly loss limit)'}
        if self.state['mode'] == 'defensive':
            if setup.get('confidence', 0) < 75:
                return {'valid': False, 'reason': 'Defensive mode: confidence < 75 required'}

        if self.state['daily_pnl'] <= -0.02 * balance:
            self.state['mode'] = 'halted_24h'
            self._save_state()
            return {'valid': False, 'reason': 'Daily loss limit reached (-2%)'}

        if self.state['weekly_pnl'] <= -0.05 * balance:
            self.state['mode'] = 'halted_72h'
            self._save_state()
            return {'valid': False, 'reason': 'Weekly loss limit reached (-5%)'}

        if self.state['total_trades_today'] >= 10:
            return {'valid': False, 'reason': 'Max 10 trades per day'}

        return {'valid': True}

    def calculate_position_size(self, balance, risk_percent, stop_loss_pips, symbol='EURUSD'):
        pip_value = PIP_VALUES.get(symbol, 10.0)
        risk_amount = balance * (risk_percent / 100)

        position_multiplier = 1.0
        if self.state['consecutive_losses'] >= 3:
            position_multiplier = 0.5
        elif self.state['consecutive_wins'] >= 3:
            position_multiplier = 1.1

        if self.state['mode'] == 'defensive':
            position_multiplier *= 0.7

        raw_lots = (risk_amount * position_multiplier) / (stop_loss_pips * pip_value)
        lots = max(0.01, round(raw_lots, 2))
        max_lots = 10.0

        return min(lots, max_lots)

    def record_trade_result(self, pnl):
        self.state['daily_pnl'] += pnl
        self.state['weekly_pnl'] += pnl
        self.state['total_trades_today'] += 1

        if pnl > 0:
            self.state['consecutive_wins'] += 1
            self.state['consecutive_losses'] = 0
        else:
            self.state['consecutive_losses'] += 1
            self.state['consecutive_wins'] = 0

        if self.state['consecutive_losses'] >= 3:
            self.state['mode'] = 'defensive'
        elif self.state['consecutive_losses'] >= 5:
            self.state['mode'] = 'halted_24h'

        if self.state['consecutive_wins'] >= 3 and self.state['mode'] == 'defensive':
            self.state['mode'] = 'normal'

        self._save_state()

    def get_status(self):
        return {
            'mode': self.state['mode'],
            'daily_pnl': round(self.state['daily_pnl'], 2),
            'weekly_pnl': round(self.state['weekly_pnl'], 2),
            'consecutive_losses': self.state['consecutive_losses'],
            'consecutive_wins': self.state['consecutive_wins'],
            'total_trades_today': self.state['total_trades_today'],
        }

    def reset(self):
        self.state = {
            'daily_pnl': 0.0,
            'weekly_pnl': 0.0,
            'consecutive_losses': 0,
            'consecutive_wins': 0,
            'last_reset_date': str(date.today()),
            'last_week_reset': str(date.today()),
            'total_trades_today': 0,
            'mode': 'normal',
        }
        self._save_state()
