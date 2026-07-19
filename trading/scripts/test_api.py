import urllib.request, json

# Test backtest endpoint
url = 'http://localhost:3000/api/backtest/run?symbol=EURUSD'
resp = urllib.request.urlopen(url)
data = json.loads(resp.read().decode())

print('Backtest Result:')
print(f'  Return: {data["total_return"]:+.2f}%')
print(f'  Trades: {data["total_trades"]}')
print(f'  PF: {data["profit_factor"]}')
print(f'  WR: {data["win_rate"]}%')
print(f'  DD: {data["max_drawdown"]:.1f}%')
print(f'  Avg R: {data["avg_r"]}')

if data.get('setup_stats'):
    print('\nSetup Stats:')
    for st, sts in data['setup_stats'].items():
        print(f'  {st}: Trades={sts["trades"]} WR={sts["win_rate"]}% P&L=${sts["pnl"]:+.2f}')

# Test health
resp2 = urllib.request.urlopen('http://localhost:3000/api/health')
h = json.loads(resp2.read().decode())
print(f'\nAPI Status: {h["status"]}')
print(f'Bot: {h["bot"]["mode"]}')
