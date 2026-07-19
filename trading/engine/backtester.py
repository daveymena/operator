import numpy as np
import pandas as pd
from .strategy import EmaWilliamsStrategy
from .config import INITIAL_CAPITAL, DEFAULT_COMMISSION, DEFAULT_LEVERAGE, PIP_VALUES

class Backtester:
    def __init__(self, initial_capital=INITIAL_CAPITAL, commission=DEFAULT_COMMISSION):
        self.initial_capital = initial_capital
        self.commission = commission
        self.results = None

    def run(self, df, params=None, symbol='EURUSD'):
        strategy = EmaWilliamsStrategy(params)
        signals, data = strategy.generate_signals(df)
        pip_value = PIP_VALUES.get(symbol, 10.0)

        capital = self.initial_capital
        trades = []
        peak_capital = capital
        max_drawdown = 0

        for signal in signals:
            entry = signal['entry']
            sl = signal['sl']
            tp = signal['tp']
            trade_type = signal['type']

            data_slice = data.iloc[signal['index']:]

            first_tp_hit = False
            first_sl_hit = False
            exit_price = entry
            exit_index = signal['index']
            exit_reason = 'open'

            for j in range(1, len(data_slice)):
                bar = data_slice.iloc[j]
                if trade_type == 'buy':
                    if bar['high'] >= tp:
                        exit_price = tp
                        exit_index = signal['index'] + j
                        exit_reason = 'tp'
                        first_tp_hit = True
                        break
                    if bar['low'] <= sl:
                        exit_price = sl
                        exit_index = signal['index'] + j
                        exit_reason = 'sl'
                        first_sl_hit = True
                        break
                else:
                    if bar['low'] <= tp:
                        exit_price = tp
                        exit_index = signal['index'] + j
                        exit_reason = 'tp'
                        first_tp_hit = True
                        break
                    if bar['high'] >= sl:
                        exit_price = sl
                        exit_index = signal['index'] + j
                        exit_reason = 'sl'
                        first_sl_hit = True
                        break

            if trade_type == 'buy':
                gross_pnl = (exit_price - entry) * 100000 * DEFAULT_LEVERAGE
            else:
                gross_pnl = (entry - exit_price) * 100000 * DEFAULT_LEVERAGE

            net_pnl = gross_pnl - self.commission

            capital += net_pnl

            trade = {
                'entry_time': signal['timestamp'],
                'exit_time': data.index[exit_index] if hasattr(data.index, '__getitem__') else exit_index,
                'type': trade_type,
                'entry': entry,
                'exit': exit_price,
                'sl': sl,
                'tp': tp,
                'exit_reason': exit_reason,
                'gross_pnl': round(gross_pnl, 2),
                'net_pnl': round(net_pnl, 2),
                'r_multiple': round(net_pnl / (abs(entry - sl) * 100000 * DEFAULT_LEVERAGE), 2) if abs(entry - sl) > 0 else 0,
                'capital_after': round(capital, 2),
            }
            trades.append(trade)

            peak_capital = max(peak_capital, capital)
            dd = (peak_capital - capital) / peak_capital * 100
            max_drawdown = max(max_drawdown, dd)

        total_net_pnl = sum(t['net_pnl'] for t in trades)
        total_gross_pnl = sum(t['gross_pnl'] for t in trades)
        total_commission = sum(t['net_pnl'] for t in trades)  # just for count

        wins = [t for t in trades if t['net_pnl'] > 0]
        losses = [t for t in trades if t['net_pnl'] <= 0]

        avg_win = np.mean([t['net_pnl'] for t in wins]) if wins else 0
        avg_loss = abs(np.mean([t['net_pnl'] for t in losses])) if losses else 0

        profit_factor = abs(sum(t['net_pnl'] for t in wins) / sum(abs(t['net_pnl']) for t in losses)) if losses and sum(abs(t['net_pnl']) for t in losses) > 0 else 0

        results = {
            'initial_capital': self.initial_capital,
            'final_capital': round(capital, 2),
            'total_return': round((capital - self.initial_capital) / self.initial_capital * 100, 2),
            'total_net_pnl': round(total_net_pnl, 2),
            'total_gross_pnl': round(total_gross_pnl, 2),
            'total_commission': round(total_commission, 2),
            'total_trades': len(trades),
            'win_trades': len(wins),
            'loss_trades': len(losses),
            'win_rate': round(len(wins) / len(trades) * 100, 2) if trades else 0,
            'avg_win': round(avg_win, 2),
            'avg_loss': round(avg_loss, 2),
            'profit_factor': round(profit_factor, 2),
            'max_drawdown': round(max_drawdown, 2),
            'expectancy': round(avg_win * len(wins) / len(trades) - avg_loss * len(losses) / len(trades), 2) if trades else 0,
            'avg_r_multiple': round(np.mean([t['r_multiple'] for t in trades]), 2) if trades else 0,
            'trades': trades,
            'params': strategy.get_params_dict(),
            'symbol': symbol,
        }
        self.results = results
        return results

    def print_report(self, results=None):
        r = results or self.results
        if not r:
            return
        print('=' * 60)
        print(f"  BACKTEST REPORT - {r['symbol']}")
        print('=' * 60)
        print(f"  Period: {r.get('period', 'N/A')}")
        print(f"  Initial Capital: ${r['initial_capital']:,.2f}")
        print(f"  Final Capital:   ${r['final_capital']:,.2f}")
        print(f"  Total Return:    {r['total_return']:+.2f}%")
        print(f"  Net Profit:      ${r['total_net_pnl']:+,.2f}")
        print('-' * 60)
        print(f"  Total Trades:    {r['total_trades']}")
        print(f"  Win Trades:      {r['win_trades']} ({r['win_rate']}%)")
        print(f"  Loss Trades:     {r['loss_trades']} ({100 - r['win_rate']:.2f}%)")
        print(f"  Avg Win:         ${r['avg_win']:+,.2f}")
        print(f"  Avg Loss:        ${r['avg_loss']:+,.2f}")
        print(f"  Profit Factor:   {r['profit_factor']}")
        print(f"  Max Drawdown:    {r['max_drawdown']:.2f}%")
        print(f"  Expectancy:      ${r['expectancy']:+,.2f}")
        print(f"  Avg R Multiple:  {r['avg_r_multiple']}")
        print('=' * 60)
