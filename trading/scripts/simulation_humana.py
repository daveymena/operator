import os, sys, json, warnings
warnings.filterwarnings('ignore')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import numpy as np
from datetime import datetime, time as dtime
from engine.hybrid_strategy import HybridStrategy
from engine.hybrid_backtester import HybridBacktester
from engine.regime_detector import RegimeDetector
from engine.risk_manager import RiskManager
from engine.partial_profit import PartialProfitManager

SYMBOLS = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF']

REAL_SYMBOLS = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDCHF']  # Los que funcionan

# Real market hours (UTC)
MARKET_HOURS = {
    'london': (8, 17),
    'new_york': (13, 22),
    'overlap': (13, 17),
    'asian': (0, 9),
    'best': (13, 17),
    'good': [(8, 12), (13, 17)],
    'avoid': [(0, 7), (20, 24)],
}

def get_market_session(hour):
    if 13 <= hour < 17: return 'overlap'
    if 8 <= hour < 13: return 'london'
    if 17 <= hour < 22: return 'new_york'
    if 0 <= hour < 9: return 'asian'
    return 'other'

def is_good_hour(hour, day):
    # Weekend filter
    if day >= 5: return False
    # Avoid Asian session (low volatility / spread)
    if hour < 8 or hour >= 20: return False
    # Friday after 17:00 = low liquidity
    if day == 4 and hour >= 17: return False
    # Monday before 08:00 = after weekend gap
    if day == 0 and hour < 8: return False
    return True

CONFIGS = [
    {
        'name': 'BOS_CLASSIC',
        'symbols': SYMBOLS,
        'params': {
            'ema_fast': 10, 'ema_slow': 30,
            'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
            'swing_strength': 2, 'ob_volume_mult': 1.0,
            'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 2.0,
            'min_confidence': 60,
            'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
            'require_wr_confirmation': True,
            'require_trend_alignment': True,
            'avoid_hours': [0,1,2,3,4,5,6,7,20,21,22,23],
        },
    },
    {
        'name': 'BOS_CONSERVATIVE',
        'symbols': SYMBOLS,
        'params': {
            'ema_fast': 12, 'ema_slow': 40,
            'williams_period': 14, 'williams_upperband': -15, 'williams_lowerband': -85,
            'swing_strength': 3, 'ob_volume_mult': 1.2,
            'sl_atr_mult': 1.8, 'tp_atr_mult': 3.5, 'min_rr': 2.0,
            'min_confidence': 65,
            'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
            'require_wr_confirmation': True,
            'require_trend_alignment': True,
            'avoid_hours': [0,1,2,3,4,5,6,7,8,18,19,20,21,22,23],
        },
    },
    {
        'name': 'SMC_FULL',
        'symbols': SYMBOLS,
        'params': {
            'ema_fast': 10, 'ema_slow': 30,
            'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
            'swing_strength': 2, 'ob_volume_mult': 1.0,
            'sl_atr_mult': 1.5, 'tp_atr_mult': 3.0, 'min_rr': 2.0,
            'min_confidence': 60,
            'enable_ob': True, 'enable_bos': True, 'enable_ema_w': False,
            'require_wr_confirmation': True,
            'require_trend_alignment': True,
            'avoid_hours': [0,1,2,3,4,5,6,7,20,21,22,23],
        },
    },
    {
        'name': 'SMC_AGGRESSIVE',
        'symbols': SYMBOLS,
        'params': {
            'ema_fast': 8, 'ema_slow': 25,
            'williams_period': 8, 'williams_upperband': -10, 'williams_lowerband': -90,
            'swing_strength': 2, 'ob_volume_mult': 1.0,
            'sl_atr_mult': 1.2, 'tp_atr_mult': 2.5, 'min_rr': 1.5,
            'min_confidence': 50,
            'enable_ob': True, 'enable_bos': True, 'enable_ema_w': True,
            'require_wr_confirmation': False,
            'require_trend_alignment': True,
            'avoid_hours': [0,1,2,3,4,5,6,7,21,22,23],
        },
    },
    {
        'name': 'BOS_PRO',
        'symbols': REAL_SYMBOLS,
        'params': {
            'ema_fast': 10, 'ema_slow': 30,
            'williams_period': 10, 'williams_upperband': -15, 'williams_lowerband': -85,
            'swing_strength': 2, 'ob_volume_mult': 1.0,
            'sl_atr_mult': 1.8, 'tp_atr_mult': 3.5, 'min_rr': 2.0,
            'min_confidence': 65,
            'enable_ob': False, 'enable_bos': True, 'enable_ema_w': False,
            'require_wr_confirmation': True,
            'require_trend_alignment': True,
            'avoid_hours': [0,1,2,3,4,5,6,7,18,19,20,21,22,23],
        },
    },
]

def load_data(symbol):
    fp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', f'{symbol}_H1.csv')
    df = pd.read_csv(fp, index_col=0, parse_dates=True)
    return df

def filter_trades_human(trades, df):
    filtered = []
    for t in trades:
        ts = t['entry_time']
        if not isinstance(ts, pd.Timestamp):
            try: ts = pd.Timestamp(ts)
            except: continue

        hour = ts.hour
        day = ts.dayofweek

        if not is_good_hour(hour, day):
            continue

        # Skip trades during major news (simplified: Friday after 13:00)
        if day == 4 and hour >= 15:
            continue

        filtered.append(t)
    return filtered

def simulate_with_psychology(trades, initial_capital=50000):
    capital = initial_capital
    peak = capital
    max_dd = 0
    trades_out = []
    consecutive_losses = 0
    max_daily_trades = 5
    daily_trades = {}
    defensive_mode = False
    weekly_loss_limit = -0.08
    weekly_pnl = 0
    week_start = None

    for t in trades:
        ts = t['entry_time']
        if not isinstance(ts, pd.Timestamp):
            try: ts = pd.Timestamp(ts)
            except: continue

        day_key = ts.date()
        week_key = ts.isocalendar()[1]

        if week_start != week_key:
            weekly_pnl = 0
            week_start = week_key

        if weekly_pnl <= capital * weekly_loss_limit:
            continue

        if day_key not in daily_trades:
            daily_trades[day_key] = 0

        # Defensive mode after losses
        if defensive_mode and t.get('confidence', 0) < 75:
            continue

        confidence = t.get('confidence', 60)
        base_risk = 0.01
        if confidence >= 85:
            base_risk = 0.02
        elif confidence >= 75:
            base_risk = 0.015
        elif confidence < 55:
            base_risk = 0.005

        if consecutive_losses >= 3:
            base_risk = 0.005
        if consecutive_losses >= 5:
            continue
        if defensive_mode:
            base_risk = min(base_risk, 0.01)

        if base_risk <= 0:
            continue

        risk_amount = capital * base_risk
        entry = t['entry']
        sl = t['sl']
        risk_pips = abs(entry - sl)
        if risk_pips <= 0:
            continue

        pip_value = 10.0
        lots = risk_amount / (risk_pips * pip_value * 100000)
        lots = max(0.01, min(round(lots, 2), 3.0))

        net_pnl = t['net_pnl'] * (lots / 1.0)
        capital += net_pnl
        weekly_pnl += net_pnl
        peak = max(peak, capital)
        dd = (peak - capital) / peak * 100
        max_dd = max(max_dd, dd)

        if net_pnl > 0:
            consecutive_losses = 0
            defensive_mode = False
        else:
            consecutive_losses += 1
            if consecutive_losses >= 3:
                defensive_mode = True

        daily_trades[day_key] += 1
        if daily_trades[day_key] > max_daily_trades:
            continue

        trades_out.append({
            **t,
            'lots': lots,
            'risk_pct': round(base_risk * 100, 2),
            'capital_after': round(capital, 2),
        })

    total_return = (capital - initial_capital) / initial_capital * 100
    wins = [t for t in trades_out if t['net_pnl'] > 0]
    losses = [t for t in trades_out if t['net_pnl'] <= 0]

    return {
        'initial_capital': initial_capital,
        'final_capital': round(capital, 2),
        'total_return': round(total_return, 2),
        'total_trades': len(trades_out),
        'win_trades': len(wins),
        'loss_trades': len(losses),
        'win_rate': round(len(wins) / len(trades_out) * 100, 1) if trades_out else 0,
        'avg_win': round(np.mean([t['net_pnl'] for t in wins]), 2) if wins else 0,
        'avg_loss': round(abs(np.mean([t['net_pnl'] for t in losses])), 2) if losses else 0,
        'profit_factor': round(abs(sum(t['net_pnl'] for t in wins) / sum(abs(t['net_pnl']) for t in losses)), 2) if losses and sum(abs(t['net_pnl']) for t in losses) > 0 else 0,
        'max_drawdown': round(max_dd, 2),
        'avg_lots': round(np.mean([t['lots'] for t in trades_out]), 2) if trades_out else 0,
        'total_volume': round(sum(t['lots'] for t in trades_out), 2),
    }

def analyze_by_session(trades):
    sessions = {'asian': [], 'london': [], 'overlap': [], 'new_york': [], 'other': []}
    for t in trades:
        ts = t['entry_time']
        if not isinstance(ts, pd.Timestamp):
            try: ts = pd.Timestamp(ts)
            except: continue
        session = get_market_session(ts.hour)
        sessions[session].append(t)

    results = {}
    for s, st in sessions.items():
        if not st:
            continue
        wins = [t for t in st if t.get('net_pnl', 0) > 0]
        pnl = sum(t.get('net_pnl', 0) for t in st)
        results[s] = {
            'trades': len(st),
            'win_rate': round(len(wins) / len(st) * 100, 1) if st else 0,
            'pnl': round(pnl, 2),
            'avg_pnl': round(pnl / len(st), 2) if st else 0,
        }
    return results

def main():
    print('=' * 90)
    print('  SIMULACION HUMANA - SMART MONEY + MARKET HOURS + PSYCHOLOGY')
    print('  Datos reales H1 | 7 pares | 4 configuraciones')
    print('=' * 90)

    all_results = []

    for config in CONFIGS:
        name = config['name']
        params = config['params']
        print(f'\n{"=" * 90}')
        print(f'  CONFIG: {name}')
        print(f'  {json.dumps(params, default=str)[:120]}...')
        print(f'{"=" * 90}')

        bt = HybridBacktester()

        config_total_return = 0
        config_total_trades = 0
        config_total_wins = 0
        config_results = []

        for symbol in config.get('symbols', SYMBOLS):
            df = load_data(symbol)
            split = int(len(df) * 0.75)

            train_df = df.iloc[:split]
            test_df = df.iloc[split:]

            raw_test = bt.run(test_df, params, symbol)

            if not raw_test or not raw_test.get('trades'):
                continue

            # Filter by market hours (human-like)
            filtered_trades = filter_trades_human(raw_test['trades'], test_df)

            if not filtered_trades:
                continue

            # Simulate human psychology + position sizing
            sim = simulate_with_psychology(filtered_trades)

            raw_train = bt.run(train_df, params, symbol)

            # Session analysis
            session_analysis = analyze_by_session(filtered_trades)

            print(f'\n  {symbol}:')
            print(f'    Train: {raw_train["total_return"]:>+7.2f}% | PF:{raw_train["profit_factor"]:.2f} | WR:{raw_train["win_rate"]}% | Trades:{raw_train["total_trades"]}')
            print(f'    Test raw:  {raw_test["total_return"]:>+7.2f}% | PF:{raw_test["profit_factor"]:.2f} | WR:{raw_test["win_rate"]}% | Trades:{raw_test["total_trades"]}')
            print(f'    Human:     {sim["total_return"]:>+7.2f}% | PF:{sim["profit_factor"]:.2f} | WR:{sim["win_rate"]}% | Trades:{sim["total_trades"]} | DD:{sim["max_drawdown"]:.1f}% | Lots:{sim["avg_lots"]}')

            if raw_test.get('setup_stats'):
                for st, sts in raw_test['setup_stats'].items():
                    print(f'      {st}: {sts["trades"]} trades WR={sts["win_rate"]}% P&L=${sts["pnl"]:+,.2f}')

            # Session breakdown
            for session, sr in session_analysis.items():
                if sr:
                    print(f'      {session:10s}: {sr["trades"]:3d} trades WR={sr["win_rate"]:5.1f}% P&L=${sr["pnl"]:+,.2f}')

            config_total_return += sim['total_return']
            config_total_trades += sim['total_trades']
            config_total_wins += sim['win_trades']

            config_results.append({
                'symbol': symbol,
                'train_return': raw_train['total_return'],
                'train_pf': raw_train['profit_factor'],
                'test_raw_return': raw_test['total_return'],
                'test_raw_pf': raw_test['profit_factor'],
                'test_raw_wr': raw_test['win_rate'],
                'test_raw_trades': raw_test['total_trades'],
                'human_return': sim['total_return'],
                'human_pf': sim['profit_factor'],
                'human_wr': sim['win_rate'],
                'human_trades': sim['total_trades'],
                'human_dd': sim['max_drawdown'],
            })

        if config_results:
            avg_human_return = sum(r['human_return'] for r in config_results) / len(config_results)
            avg_human_wr = sum(r['human_wr'] for r in config_results) / len(config_results)
            avg_human_pf = sum(r['human_pf'] for r in config_results) / len(config_results)
            avg_human_dd = sum(r['human_dd'] for r in config_results) / len(config_results)
            avg_raw_return = sum(r['test_raw_return'] for r in config_results) / len(config_results)
            total_trades = sum(r['test_raw_trades'] for r in config_results)

            print(f'\n  PROMEDIO {name}:')
            print(f'    Test Raw:    Return={avg_raw_return:>+7.2f}% | Trades={total_trades}')
            print(f'    Human Sim:   Return={avg_human_return:>+7.2f}% | WR={avg_human_wr:.1f}% | PF={avg_human_pf:.2f} | DD={avg_human_dd:.1f}%')

            all_results.extend(config_results)

    # Final summary
    print(f'\n{"=" * 90}')
    print(f'  COMPARATIVA FINAL - SIMULACION HUMANA')
    print(f'{"=" * 90}')
    print(f'  {"Config":25s} {"Symbol":8s} | {"Raw R":>7s} | {"Raw PF":>6s} | {"Raw WR":>6s} | {"Raw T":>5s} | {"Human R":>7s} | {"Human PF":>6s} | {"Human WR":>6s} | {"Human DD":>7s}')
    print(f'  {"-"*90}')
    for r in all_results:
        print(f'  {r["symbol"]:8s} | {r["test_raw_return"]:>+6.2f}% | {r["test_raw_pf"]:>5.2f} | {r["test_raw_wr"]:>5.1f}% | {r["test_raw_trades"]:>4d} | {r["human_return"]:>+6.2f}% | {r["human_pf"]:>5.2f} | {r["human_wr"]:>5.1f}% | {r["human_dd"]:>5.1f}%')

    print(f'\n{"=" * 90}')
    print('  SIMULACION COMPLETADA')
    print(f'{"=" * 90}')

    # Portfolio simulation: BEST config on BEST pairs only
    print(f'\n{"=" * 90}')
    print('  PORTFOLIO: BOS_PRO en EURUSD + GBPUSD + AUDUSD + USDCHF')
    print(f'{"=" * 90}')
    print(f'  Estrategia: BOS Continuation solo, London+Overlap horas')
    print(f'  Gestión: 1-2% riesgo, máx 5 trades/día, stop semanal -8%')
    print(f'  Filtro neuronal activo, sin OB_Trend')
    print(f'')
    print(f'  Pares: EURUSD, GBPUSD, AUDUSD, USDCHF')
    print(f'  Horario: 8-17 UTC (London + Overlap)')
    print(f'  SL: 1.8 ATR | TP: 3.5 ATR | Confianza mín: 65')
    print(f'')
    print(f'  Para re-ejecutar con nuevos params: python scripts/simulation_humana.py')
    print(f'{"=" * 90}')

if __name__ == '__main__':
    main()
