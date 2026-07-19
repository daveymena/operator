import numpy as np
import pandas as pd
from .hybrid_strategy import HybridStrategy
from .config import INITIAL_CAPITAL, DEFAULT_COMMISSION, DEFAULT_LEVERAGE, PIP_VALUES

class HybridBacktester:
    def __init__(self, capital=INITIAL_CAPITAL, commission=DEFAULT_COMMISSION):
        self.capital = capital
        self.commission = commission

    def run(self, df, params=None, symbol='EURUSD'):
        strat = HybridStrategy(params)
        setups, data = strat.analyze(df)
        pip_value = PIP_VALUES.get(symbol, 10.0)

        capital = self.capital
        trades = []
        peak = capital
        max_dd = 0

        for s in setups:
            entry = s['entry']
            sl = s['sl']
            tp = s['tp']
            trade_type = s['type']
            idx = s['index']

            data_slice = data.iloc[idx:]
            exit_idx = idx
            exit_price = entry
            exit_reason = 'open'

            for j in range(1, len(data_slice)):
                bar = data_slice.iloc[j]
                if trade_type == 'buy':
                    if bar['high'] >= tp:
                        exit_price = tp; exit_idx = idx + j; exit_reason = 'tp'; break
                    if bar['low'] <= sl:
                        exit_price = sl; exit_idx = idx + j; exit_reason = 'sl'; break
                else:
                    if bar['low'] <= tp:
                        exit_price = tp; exit_idx = idx + j; exit_reason = 'tp'; break
                    if bar['high'] >= sl:
                        exit_price = sl; exit_idx = idx + j; exit_reason = 'sl'; break

            if symbol in ['USDJPY', 'USDCAD', 'USDCHF']:
                gross = (exit_price - entry) * 100000 * DEFAULT_LEVERAGE / exit_price if trade_type == 'buy' else (entry - exit_price) * 100000 * DEFAULT_LEVERAGE / entry
            else:
                gross = (exit_price - entry) * 100000 * DEFAULT_LEVERAGE if trade_type == 'buy' else (entry - exit_price) * 100000 * DEFAULT_LEVERAGE
            net = gross - self.commission
            capital += net
            risk_amount = abs(entry - sl)
            if symbol in ['USDJPY', 'USDCAD', 'USDCHF']:
                risk_amount = risk_amount / entry
            r_mult = net / (risk_amount * 100000 * DEFAULT_LEVERAGE) if risk_amount > 0 else 0

            trades.append({
                'entry_time': s['timestamp'],
                'exit_time': data.index[exit_idx] if hasattr(data.index, '__getitem__') else exit_idx,
                'type': trade_type,
                'setup': s['setup_type'],
                'confidence': s['confidence'],
                'entry': entry, 'exit': exit_price,
                'sl': sl, 'tp': tp,
                'exit_reason': exit_reason,
                'gross_pnl': round(gross, 2),
                'net_pnl': round(net, 2),
                'r_multiple': round(r_mult, 2),
                'capital_after': round(capital, 2),
                'rr': s['rr'],
                'reasons': s['reasons'],
            })

            peak = max(peak, capital)
            dd = (peak - capital) / peak * 100
            max_dd = max(max_dd, dd)

        wins = [t for t in trades if t['net_pnl'] > 0]
        losses = [t for t in trades if t['net_pnl'] <= 0]
        avg_win = np.mean([t['net_pnl'] for t in wins]) if wins else 0
        avg_loss = abs(np.mean([t['net_pnl'] for t in losses])) if losses else 0
        profit_factor = abs(sum(t['net_pnl'] for t in wins) / sum(abs(t['net_pnl']) for t in losses)) if losses and sum(abs(t['net_pnl']) for t in losses) > 0 else 0

        # Per setup stats
        setup_stats = {}
        for t in trades:
            st = t['setup']
            if st not in setup_stats:
                setup_stats[st] = {'trades': 0, 'wins': 0, 'pnl': 0}
            setup_stats[st]['trades'] += 1
            setup_stats[st]['pnl'] += t['net_pnl']
            if t['net_pnl'] > 0:
                setup_stats[st]['wins'] += 1
        for st, sts in setup_stats.items():
            sts['win_rate'] = round(sts['wins'] / sts['trades'] * 100, 1) if sts['trades'] > 0 else 0

        return {
            'initial_capital': self.capital,
            'final_capital': round(capital, 2),
            'total_return': round((capital - self.capital) / self.capital * 100, 2),
            'total_net_pnl': round(sum(t['net_pnl'] for t in trades), 2),
            'total_trades': len(trades),
            'win_trades': len(wins), 'loss_trades': len(losses),
            'win_rate': round(len(wins) / len(trades) * 100, 2) if trades else 0,
            'avg_win': round(avg_win, 2), 'avg_loss': round(avg_loss, 2),
            'profit_factor': round(profit_factor, 2),
            'max_drawdown': round(max_dd, 2),
            'avg_r': round(np.mean([t['r_multiple'] for t in trades]), 2) if trades else 0,
            'avg_confidence': round(np.mean([t['confidence'] for t in trades]), 1) if trades else 0,
            'setup_stats': setup_stats,
            'trades': trades,
            'params': strat.get_params(),
            'symbol': symbol,
        }

    def print_report(self, r):
        print('=' * 70)
        print(f'  HYBRID BACKTEST - {r["symbol"]}')
        print('=' * 70)
        print(f'  Capital: ${r["initial_capital"]:,.0f} → ${r["final_capital"]:,.0f}')
        print(f'  Return:  {r["total_return"]:+.2f}%  |  Net P&L: ${r["total_net_pnl"]:+,.2f}')
        print(f'  Trades:  {r["total_trades"]}  |  WR: {r["win_rate"]}%  |  PF: {r["profit_factor"]}')
        print(f'  Avg Win: ${r["avg_win"]:+,.2f}  |  Avg Loss: ${r["avg_loss"]:+,.2f}')
        print(f'  Max DD:  {r["max_drawdown"]:.2f}%  |  Avg R: {r["avg_r"]}  |  Avg Conf: {r["avg_confidence"]}%')
        print('-' * 70)
        print('  Por Setup:')
        for st, sts in r['setup_stats'].items():
            print(f'    {st:20s}  Trades:{sts["trades"]:4d}  WR:{sts["win_rate"]:6.1f}%  P&L:${sts["pnl"]:+,.2f}')
        print('=' * 70)
