import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.genetic_optimizer import GeneticOptimizer
from engine.backtester import Backtester
from engine.neural_filter import NeuralFilter

def main():
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'
    generations = int(sys.argv[2]) if len(sys.argv) > 2 else 15

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    filepath = os.path.join(data_dir, f'{symbol}_H1.csv')

    if not os.path.exists(filepath):
        result = {'error': f'No data for {symbol}', 'symbol': symbol}
        print(json.dumps(result))
        return

    df = pd.read_csv(filepath, index_col=0, parse_dates=True)
    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    ga = GeneticOptimizer(population_size=20, generations=generations)
    best_params, history = ga.optimize(df_train, symbol, verbose=False)

    val = ga.validate(df_train, df_test, best_params, symbol)

    nf = NeuralFilter()
    nn_report = nf.train(pd.concat([df_train, df_test]), best_params, balance=True)

    model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
    os.makedirs(model_dir, exist_ok=True)

    if nn_report:
        model_path = os.path.join(model_dir, f'neural_filter_{symbol}.pkl')
        nf.save(model_path)

    result = {
        'symbol': symbol,
        'best_params': best_params,
        'train_results': {k: v for k, v in val['train'].items() if k != 'trades'},
        'test_results': {k: v for k, v in val['test'].items() if k != 'trades'},
        'fitness_history': [round(f, 2) for f in history],
        'neural_network': nn_report,
        'generations': generations,
    }
    print(json.dumps(result))

if __name__ == '__main__':
    main()
