import random
import numpy as np
import pandas as pd
from .backtester import Backtester
from .config import OPTIMIZATION_RANGES

class GeneticOptimizer:
    def __init__(self, population_size=20, generations=30, mutation_rate=0.2, elite_size=4):
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.elite_size = elite_size
        self.best_chromosome = None
        self.best_fitness = -np.inf
        self.fitness_history = []

    def _random_chromosome(self):
        return {
            'ema_fast': random.randint(*OPTIMIZATION_RANGES['ema_fast']),
            'ema_slow': random.randint(*OPTIMIZATION_RANGES['ema_slow']),
            'williams_period': random.randint(*OPTIMIZATION_RANGES['williams_period']),
            'williams_upperband': random.randint(*OPTIMIZATION_RANGES['williams_upperband']),
            'williams_lowerband': random.randint(*OPTIMIZATION_RANGES['williams_lowerband']),
            'stoploss': random.randint(*OPTIMIZATION_RANGES['stoploss']),
            'takeprofit': random.randint(*OPTIMIZATION_RANGES['takeprofit']),
        }

    def _validate(self, chrom):
        if chrom['ema_fast'] >= chrom['ema_slow']:
            return False
        if chrom['williams_upperband'] <= chrom['williams_lowerband']:
            return False
        return True

    def _fitness(self, chrom, df, symbol='EURUSD'):
        if not self._validate(chrom):
            return -99999
        try:
            bt = Backtester()
            results = bt.run(df, chrom, symbol)
            if results['total_trades'] < 5:
                return -99999

            return_rate = results['total_return']
            max_dd = results['max_drawdown']
            win_rate = results['win_rate']
            profit_factor = results['profit_factor']
            trades = results['total_trades']

            if max_dd > 30:
                return -99999

            score = (return_rate * 1.0
                     - max_dd * 1.5
                     + win_rate * 0.5
                     + profit_factor * 10
                     + min(trades, 200) * 0.1)
            return score
        except Exception:
            return -99999

    def _crossover(self, parent1, parent2):
        child = {}
        for key in parent1:
            child[key] = parent1[key] if random.random() < 0.5 else parent2[key]
        return child

    def _mutate(self, chrom):
        mutated = chrom.copy()
        for key in mutated:
            if random.random() < self.mutation_rate:
                lo, hi = OPTIMIZATION_RANGES[key]
                mutated[key] = random.randint(lo, hi)
        return mutated

    def optimize(self, df, symbol='EURUSD', verbose=True):
        population = [self._random_chromosome() for _ in range(self.population_size)]

        for gen in range(self.generations):
            fitness_scores = []
            for chrom in population:
                fit = self._fitness(chrom, df, symbol)
                fitness_scores.append((fit, chrom))

            fitness_scores.sort(key=lambda x: x[0], reverse=True)

            if fitness_scores[0][0] > self.best_fitness:
                self.best_fitness = fitness_scores[0][0]
                self.best_chromosome = fitness_scores[0][1]

            self.fitness_history.append(fitness_scores[0][0])

            if verbose:
                params_str = ' '.join(f'{k}={v}' for k, v in fitness_scores[0][1].items())
                print(f'Gen {gen+1:2d}/{self.generations} | Best: {fitness_scores[0][0]:+.2f} | Params: {params_str}')

            fittest = [fs[1] for fs in fitness_scores[:self.elite_size]]
            next_population = list(fittest)

            while len(next_population) < self.population_size:
                parent1 = random.choice(fittest)
                parent2 = random.choice(fittest)
                child = self._crossover(parent1, parent2)
                child = self._mutate(child)
                next_population.append(child)

            population = next_population

        return self.best_chromosome, self.fitness_history

    def validate(self, df_train, df_test, best_params, symbol='EURUSD'):
        bt = Backtester()
        train_results = bt.run(df_train, best_params, symbol)
        test_results = bt.run(df_test, best_params, symbol)
        return {
            'train': train_results,
            'test': test_results,
            'params': best_params,
        }
