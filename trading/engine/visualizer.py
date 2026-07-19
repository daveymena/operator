import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.dates as mdates
import pandas as pd
import numpy as np
import os
import base64
from io import BytesIO

plt.style.use('dark_background')
COLORS = {'buy': '#00ff88', 'sell': '#ff4466', 'sl': '#ff2222', 'tp': '#22ff22'}

class TradeVisualizer:
    def __init__(self, output_dir=None):
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = output_dir or os.path.join(base, 'data', 'charts')
        os.makedirs(self.output_dir, exist_ok=True)

    def plot_candlestick_chart(self, df, trades, title='', max_candles=200):
        data = df.tail(max_candles).copy()
        data['bar_idx'] = range(len(data))

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(20, 10), gridspec_kw={'height_ratios': [3, 1]})
        fig.patch.set_facecolor('#1a1a2e')
        ax1.set_facecolor('#16213e')
        ax2.set_facecolor('#16213e')

        for idx, row in data.iterrows():
            color = '#00ff88' if row['close'] >= row['open'] else '#ff4466'
            ax1.plot([row['bar_idx'], row['bar_idx']], [row['low'], row['high']],
                     color=color, linewidth=1, alpha=0.5)
            ax1.bar(row['bar_idx'], height=abs(row['close'] - row['open']),
                    bottom=min(row['open'], row['close']),
                    width=0.6, color=color, alpha=0.9)

        ema_fast_col = 'ema_fast' if 'ema_fast' in data.columns else None
        ema_slow_col = 'ema_slow' if 'ema_slow' in data.columns else None

        if ema_fast_col:
            ax1.plot(data['bar_idx'], data[ema_fast_col], color='#ffd700', linewidth=1, alpha=0.7, label='EMA Fast')
        if ema_slow_col:
            ax1.plot(data['bar_idx'], data[ema_slow_col], color='#ff8c00', linewidth=1, alpha=0.7, label='EMA Slow')

        for t in trades:
            entry_time = t.get('entry_time')
            exit_time = t.get('exit_time')
            if entry_time is not None and entry_time not in data.index:
                if exit_time is None or exit_time not in data.index:
                    continue
            if entry_time is None:
                continue
                continue

            if entry_time in data.index:
                e_idx = data.index.get_loc(entry_time)
                color = COLORS[t['type']]
                ax1.scatter(e_idx, t['entry'], color=color, s=120, marker='^' if t['type'] == 'buy' else 'v',
                           zorder=5, edgecolors='white', linewidth=1.5)

                sl_color = '#ff2222' if t['type'] == 'buy' else '#22ff22'
                ax1.axhline(y=t['sl'], xmin=e_idx/len(data), xmax=(e_idx+1)/len(data),
                           color=sl_color, linewidth=1, linestyle='--', alpha=0.5)
                ax1.axhline(y=t['tp'], xmin=e_idx/len(data), xmax=(e_idx+1)/len(data),
                           color='#22ff22' if t['type'] == 'buy' else '#ff2222',
                           linewidth=1, linestyle=':', alpha=0.5)

            if exit_time in data.index:
                x_idx = data.index.get_loc(exit_time)
                exit_color = COLORS['tp'] if t.get('exit_reason') == 'tp' else COLORS['sl']
                ax1.scatter(x_idx, t['exit'], color=exit_color, s=100, marker='o', zorder=5, edgecolors='white', linewidth=1)

        ax1.set_title(title, color='white', fontsize=16, fontweight='bold', pad=20)
        ax1.set_ylabel('Price', color='white')
        ax1.legend(loc='upper left', facecolor='#1a1a2e', edgecolor='white')
        ax1.grid(True, alpha=0.1)
        ax1.tick_params(colors='white')

        if 'tick_volume' in data.columns:
            vol_colors = ['#00ff88' if data['close'].iloc[i] >= data['open'].iloc[i] else '#ff4466' for i in range(len(data))]
            ax2.bar(data['bar_idx'], data['tick_volume'], color=vol_colors, alpha=0.5, width=0.6)
            ax2.set_ylabel('Volume', color='white')
            ax2.grid(True, alpha=0.1)

        ax2.tick_params(colors='white')
        plt.tight_layout()
        return fig

    def plot_equity_curve(self, trades, title='Equity Curve'):
        fig, ax = plt.subplots(figsize=(16, 6))
        fig.patch.set_facecolor('#1a1a2e')
        ax.set_facecolor('#16213e')

        capital = [100000]
        for t in trades:
            capital.append(capital[-1] + t['net_pnl'])

        ax.plot(range(len(capital)), capital, color='#00ff88', linewidth=2, label='Equity')
        ax.fill_between(range(len(capital)), capital, alpha=0.1, color='#00ff88')

        peak = np.maximum.accumulate(capital)
        dd = (peak - capital) / peak * 100
        ax.fill_between(range(len(capital)), 0, -dd * 10, alpha=0.2, color='#ff4466', label='Drawdown')

        ax.axhline(y=100000, color='#ffd700', linewidth=1, linestyle='--', alpha=0.5, label='Initial')

        ax.set_title(title, color='white', fontsize=14, fontweight='bold')
        ax.set_xlabel('Trade #', color='white')
        ax.set_ylabel('Capital ($)', color='white')
        ax.legend(loc='upper left', facecolor='#1a1a2e', edgecolor='white')
        ax.grid(True, alpha=0.1)
        ax.tick_params(colors='white')
        plt.tight_layout()
        return fig

    def plot_setup_performance(self, results):
        setup_stats = results.get('setup_stats', {})
        if not setup_stats:
            return None

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        fig.patch.set_facecolor('#1a1a2e')

        setups = list(setup_stats.keys())
        pnls = [setup_stats[s]['pnl'] for s in setups]
        wrs = [setup_stats[s]['win_rate'] for s in setups]
        counts = [setup_stats[s]['trades'] for s in setups]

        colors = ['#00ff88' if p >= 0 else '#ff4466' for p in pnls]
        ax1.bar(setups, pnls, color=colors, alpha=0.8)
        ax1.set_facecolor('#16213e')
        ax1.set_title('P&L por Setup', color='white', fontsize=12)
        ax1.set_ylabel('P&L ($)', color='white')
        ax1.axhline(y=0, color='white', linewidth=0.5, alpha=0.3)
        ax1.tick_params(colors='white')
        ax1.grid(True, alpha=0.1)

        bars = ax2.bar(setups, wrs, color='#00ff88', alpha=0.8)
        for bar, count in zip(bars, counts):
            ax2.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                    f'n={count}', ha='center', color='white', fontsize=9)
        ax2.set_facecolor('#16213e')
        ax2.set_title('Win Rate por Setup', color='white', fontsize=12)
        ax2.set_ylabel('Win Rate (%)', color='white')
        ax2.axhline(y=50, color='#ffd700', linewidth=1, linestyle='--', alpha=0.5)
        ax2.tick_params(colors='white')
        ax2.grid(True, alpha=0.1)

        plt.tight_layout()
        return fig

    def save_chart(self, fig, filename):
        filepath = os.path.join(self.output_dir, filename)
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)
        return filepath

    def to_base64(self, fig):
        buf = BytesIO()
        fig.savefig(buf, format='png', dpi=120, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()

    def generate_full_report(self, df, results, title=''):
        charts = {}

        fig = self.plot_candlestick_chart(df, results.get('trades', []), title)
        charts['candlestick'] = self.to_base64(fig)

        fig = self.plot_equity_curve(results.get('trades', []), title)
        charts['equity'] = self.to_base64(fig)

        fig = self.plot_setup_performance(results)
        if fig:
            charts['setup_perf'] = self.to_base64(fig)

        return charts

    def generate_summary_html(self, symbol, results, charts):
        r = results
        trades_html = ''
        for t in r.get('trades', [])[-20:]:
            pnl_class = 'win' if t['net_pnl'] > 0 else 'loss'
            trades_html += f'''
            <tr class="{pnl_class}">
                <td>{t.get('setup', 'N/A')}</td>
                <td>{t['type']}</td>
                <td>{t['entry']:.5f}</td>
                <td>{t['exit']:.5f}</td>
                <td class="{pnl_class}">${t['net_pnl']:+,.2f}</td>
                <td>{t.get('exit_reason', 'N/A')}</td>
                <td>{t.get('confidence', 0)}%</td>
            </tr>'''

        equity_img = f'<img src="data:image/png;base64,{charts.get("equity", "")}" style="width:100%;max-width:900px">'
        candle_img = f'<img src="data:image/png;base64,{charts.get("candlestick", "")}" style="width:100%;max-width:900px">'
        setup_img = ''
        if 'setup_perf' in charts:
            setup_img = f'<img src="data:image/png;base64,{charts["setup_perf"]}" style="width:100%;max-width:700px">'

        setup_rows = ''
        for st, sts in r.get('setup_stats', {}).items():
            setup_rows += f'<tr><td>{st}</td><td>{sts["trades"]}</td><td>{sts["win_rate"]}%</td><td class="{"win" if sts["pnl"] > 0 else "loss"}">${sts["pnl"]:+,.2f}</td></tr>'

        html = f'''
        <!DOCTYPE html>
        <html>
        <head><title>Trading Report - {symbol}</title>
        <style>
            body {{ background:#0f0f23; color:#fff; font-family:monospace; padding:20px; }}
            h1 {{ color:#00ff88; border-bottom:2px solid #00ff88; padding-bottom:10px; }}
            h2 {{ color:#ffd700; }}
            .metrics {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; margin:20px 0; }}
            .metric {{ background:#1a1a3e; padding:15px; border-radius:8px; text-align:center; }}
            .metric .value {{ font-size:24px; font-weight:bold; }}
            .metric .label {{ color:#888; font-size:12px; }}
            .win {{ color:#00ff88; }}
            .loss {{ color:#ff4466; }}
            table {{ width:100%; border-collapse:collapse; margin:20px 0; background:#1a1a3e; }}
            th, td {{ padding:8px 12px; text-align:left; border-bottom:1px solid #333; }}
            th {{ background:#16213e; color:#ffd700; }}
            img {{ border-radius:8px; margin:20px 0; }}
            .chart-container {{ background:#1a1a3e; padding:20px; border-radius:8px; margin:20px 0; }}
        </style>
        </head>
        <body>
        <h1>📊 TRADING REPORT - {symbol}</h1>

        <div class="metrics">
            <div class="metric"><div class="value win">${r["final_capital"]:,.0f}</div><div class="label">Final Capital</div></div>
            <div class="metric"><div class="value {"win" if r["total_return"] > 0 else "loss"}">{r["total_return"]:+.2f}%</div><div class="label">Total Return</div></div>
            <div class="metric"><div class="value">{r["profit_factor"]}</div><div class="label">Profit Factor</div></div>
            <div class="metric"><div class="value">{r["win_rate"]}%</div><div class="label">Win Rate</div></div>
            <div class="metric"><div class="value">{r["total_trades"]}</div><div class="label">Total Trades</div></div>
            <div class="metric"><div class="value loss">{r["max_drawdown"]:.1f}%</div><div class="label">Max Drawdown</div></div>
        </div>

        <div class="chart-container"><h2>📈 Equity Curve</h2>{equity_img}</div>
        <div class="chart-container"><h2>🕯️ Last Trades</h2>{candle_img}</div>
        <div class="chart-container"><h2>🎯 Performance por Setup</h2>{setup_img}</div>

        <h2>📋 Setup Stats</h2>
        <table><tr><th>Setup</th><th>Trades</th><th>Win Rate</th><th>P&L</th></tr>{setup_rows}</table>

        <h2>📋 Last 20 Trades</h2>
        <table><tr><th>Setup</th><th>Type</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Exit Reason</th><th>Conf</th></tr>{trades_html}</table>
        </body></html>'''
        return html

    def save_html_report(self, symbol, results, charts):
        html = self.generate_summary_html(symbol, results, charts)
        filepath = os.path.join(self.output_dir, f'report_{symbol}.html')
        with open(filepath, 'w') as f:
            f.write(html)
        return filepath
