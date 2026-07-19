import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from engine.regime_detector import RegimeDetector
from engine.risk_manager import RiskManager
from engine.config import SYMBOLS

def main():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')

    regimes = {}
    for symbol in SYMBOLS[:3]:
        filepath = os.path.join(data_dir, f'{symbol}_H1.csv')
        if os.path.exists(filepath):
            df = pd.read_csv(filepath, index_col=0, parse_dates=True).tail(200)
            detector = RegimeDetector()
            regimes[symbol] = detector.analyze(df)
        else:
            regimes[symbol] = {'regime': 'unknown', 'error': 'no data'}

    risk = RiskManager()
    risk_status = risk.get_status()

    result = {
        'regimes': regimes,
        'risk': risk_status,
        'modules': {
            'strategy': {'status': 'Available', 'type': 'EMA + Williams %R', 'params_count': 7},
            'genetic_optimizer': {'status': 'Available', 'algorithm': 'Evolutivo'},
            'neural_filter': {'status': 'Available', 'model': 'MLPClassifier (sklearn)'},
            'risk_manager': {'status': 'Active', 'mode': risk_status['mode']},
            'partial_profit': {'status': 'Available'},
            'regime_detector': {'status': 'Active'},
        },
        'recommendation': 'Sistema listo para operar',
        'symbols_available': len([s for s in SYMBOLS if os.path.exists(os.path.join(data_dir, f'{s}_H1.csv'))]),
    }
    print(json.dumps(result))

if __name__ == '__main__':
    main()
