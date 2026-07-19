import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.data_provider import DataProvider

def main():
    print('=' * 60)
    print('  DESCARGA DE DATOS REALES (Yahoo Finance)')
    print('=' * 60)

    provider = DataProvider()

    if provider.sources.get('yfinance'):
        print('\nFuente: Yahoo Finance (datos reales)\n')
    else:
        print('\nFuente: Sintetica (sin conexion a internet)\n')

    symbols = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF']
    timeframe = 'H1'

    provider.save_all_data(symbols=symbols, timeframe=timeframe, years=2)

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    total_size = 0
    print(f'\nArchivos guardados en: {data_dir}')
    for f in os.listdir(data_dir):
        if f.endswith('.csv'):
            fp = os.path.join(data_dir, f)
            size = os.path.getsize(fp)
            df_len = len(open(fp).readlines()) - 1
            print(f'  {f}: {df_len} filas ({size/1024:.0f} KB)')
            total_size += size

    print(f'\nTotal: {total_size/1024:.0f} KB')
    print('Descarga completada.')

if __name__ == '__main__':
    main()
