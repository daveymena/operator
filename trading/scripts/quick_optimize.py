import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.genetic_optimizer import GeneticOptimizer
from engine.backtester import Backtester

df = pd.read_csv('data/EURUSD_H1.csv', index_col=0, parse_dates=True)
df_train = df.iloc[:13000]
df_test = df.iloc[13000:]

print('Optimizando con Algoritmo Genetico (5 generaciones, poblacion 4)...')
ga = GeneticOptimizer(population_size=4, generations=5)
best, history = ga.optimize(df_train, 'EURUSD', verbose=True)

print(f'\nMejores parametros encontrados:')
for k, v in best.items():
    print(f'  {k}: {v}')
print(f'Fitness history: {[round(h, 2) for h in history]}')

val = ga.validate(df_train, df_test, best, 'EURUSD')
train_r = val['train']
test_r = val['test']
print(f'\nTrain: Return={train_r["total_return"]:+.2f}%  PF={train_r["profit_factor"]}  WR={train_r["win_rate"]}%  DD={train_r["max_drawdown"]}%')
print(f'Test:  Return={test_r["total_return"]:+.2f}%  PF={test_r["profit_factor"]}  WR={test_r["win_rate"]}%  DD={test_r["max_drawdown"]}%')
print(f'Trades: Train={train_r["total_trades"]}  Test={test_r["total_trades"]}')
