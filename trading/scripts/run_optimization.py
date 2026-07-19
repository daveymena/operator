import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.strategy import EmaWilliamsStrategy
from engine.backtester import Backtester
from engine.genetic_optimizer import GeneticOptimizer
from engine.neural_filter import NeuralFilter
from engine.config import DEFAULT_PARAMS

def load_data(symbol='EURUSD', timeframe='H1'):
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    filepath = os.path.join(data_dir, f'{symbol}_{timeframe}.csv')
    if not os.path.exists(filepath):
        print(f'Datos no encontrados: {filepath}')
        return None
    df = pd.read_csv(filepath, index_col=0, parse_dates=True)
    print(f'Cargados {len(df)} registros de {symbol}')
    return df

def main():
    print('=' * 60)
    print('  SISTEMA DE TRADING - OPTIMIZACION COMPLETA')
    print('=' * 60)

    symbol = 'EURUSD'
    df = load_data(symbol, 'H1')
    if df is None:
        print('Ejecuta primero: python scripts/download_data.py')
        return

    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    print(f'\nTrain: {len(df_train)} registros ({df_train.index[0].date()} a {df_train.index[-1].date()})')
    print(f'Test:  {len(df_test)} registros ({df_test.index[0].date()} a {df_test.index[-1].date()})')
    print()

    print('1. Backtest inicial con parametros por defecto')
    print('-' * 40)
    bt = Backtester()
    base_results = bt.run(df_train, DEFAULT_PARAMS, symbol)
    bt.print_report(base_results)

    print('\n2. Optimizacion con Algoritmo Genetico')
    print('-' * 40)
    ga = GeneticOptimizer(population_size=20, generations=15)
    best_params, history = ga.optimize(df_train, symbol)
    print(f'\nMejores parametros encontrados:')
    for k, v in best_params.items():
        print(f'  {k}: {v}')

    print(f'\n3. Validacion del modelo optimizado')
    print('-' * 40)
    val = ga.validate(df_train, df_test, best_params, symbol)

    print('\n--- RESULTADOS TRAIN ---')
    bt.print_report(val['train'])

    print('\n--- RESULTADOS TEST (OUT-OF-SAMPLE) ---')
    bt.print_report(val['test'])

    print('\n4. Entrenamiento de Red Neuronal (Filtro de senales)')
    print('-' * 40)
    nf = NeuralFilter()
    report = nf.train(pd.concat([df_train, df_test]), best_params, balance=True)

    if report:
        print(f'Muestras de entrenamiento: {report["samples"]}')
        print(f'Accuracy Train: {report["train_accuracy"]}%')
        print(f'Accuracy Test:  {report["test_accuracy"]}%')
        print(f'Matriz de confusion (test):')
        cm = report['confusion_matrix']
        print(f'  [[TN={cm[0][0]}  FP={cm[0][1]}]')
        print(f'   [FN={cm[1][0]}  TP={cm[1][1]}]]')

        model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
        os.makedirs(model_dir, exist_ok=True)
        model_path = os.path.join(model_dir, f'neural_filter_{symbol}.pkl')
        nf.save(model_path)
        print(f'Modelo guardado: {model_path}')

        if report.get('feature_importance'):
            print('\nTop 10 features mas importantes:')
            for fi in report['feature_importance'][:10]:
                print(f'  {fi["feature"]}: {fi["importance"]*100:.2f}%')
    else:
        print('No suficientes datos para entrenar la red neuronal.')

    print('\n' + '=' * 60)
    print('  OPTIMIZACION COMPLETADA')
    print('=' * 60)

if __name__ == '__main__':
    main()
