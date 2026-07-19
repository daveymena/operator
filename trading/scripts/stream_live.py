import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from datetime import datetime

class LiveStreamer:
    def __init__(self, symbol='EURUSD', timeframe='H1'):
        self.symbol = symbol
        self.timeframe = timeframe
        self.last_candle_time = None
        self.data = []

    def fetch_recent(self):
        from engine.data_provider import DataProvider
        dp = DataProvider()
        df = dp.get_recent_data(self.symbol, self.timeframe, days=3)
        return df

    def poll_loop(self, interval_sec=60):
        print(f'Streaming {self.symbol} {self.timeframe}...')
        while True:
            try:
                df = self.fetch_recent()
                if df is not None and len(df) > 0:
                    last_idx = df.index[-1]
                    last_candle = df.iloc[-1].to_dict()
                    last_candle['timestamp'] = str(last_idx)

                    if self.last_candle_time != str(last_idx):
                        self.last_candle_time = str(last_idx)
                        print(f'[{datetime.now().strftime("%H:%M:%S")}] '
                              f'New: {self.symbol} O:{last_candle["open"]:.5f} '
                              f'H:{last_candle["high"]:.5f} '
                              f'L:{last_candle["low"]:.5f} '
                              f'C:{last_candle["close"]:.5f}')
                        self.data.append(last_candle)

                        if len(self.data) >= 200:
                            self.data = self.data[-200:]

                time.sleep(interval_sec)
            except KeyboardInterrupt:
                print('\nStream detenido.')
                break
            except Exception as e:
                print(f'Error: {e}')
                time.sleep(interval_sec)

    def get_cached_dataframe(self):
        if not self.data:
            return None
        return pd.DataFrame(self.data)


class TradingViewStreamer:
    def __init__(self, symbol='EURUSD', timeframe='60'):
        self.symbol = symbol
        self.timeframe = timeframe
        self.ws = None

    def connect(self):
        try:
            import websocket
            import json as j

            tradingview_socket = "wss://data.tradingview.com/socket.io/websocket"
            ws = websocket.WebSocket()
            ws.connect(tradingview_socket, timeout=10)

            ws.send(j.dumps({'m': 'quote_create_session', 'p': ['unauthorized_user_session']}))
            ws.send(j.dumps({'m': 'quote_set_fields', 'p': ['unauthorized_user_session', 'base_currency_logo_id', 'base_currency_id', 'ch', 'chp', 'current_session', 'currency_logo_id', 'description', 'exchange', 'format', 'fractional', 'is_tradable', 'language', 'local_description', 'listed_exchange', 'logoid', 'lp', 'lp_time', 'minmov', 'minmove2', 'name', 'pricescale', 'pro_name', 'short_name', 'status', 'symbol', 'type', 'typespecs', 'update_mode', 'volume', 'ask', 'bid', 'high_price', 'low_price', 'open_price', 'prev_close_price', 'rch', 'rchp']}))
            ws.send(j.dumps({'m': 'quote_add_symbols', 'p': ['unauthorized_user_session', f'FX_IDC:{self.symbol}']}))

            self.ws = ws
            return True
        except Exception as e:
            print(f'TradingView WS error: {e}')
            return False

    def get_realtime_price(self):
        if not self.ws:
            return None
        try:
            self.ws.send(json.dumps({'m': 'quote_fast_symbols', 'p': ['unauthorized_user_session', f'FX_IDC:{self.symbol}']}))
            result = self.ws.recv()
            if result:
                return result
        except:
            pass
        return None


if __name__ == '__main__':
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'

    print(f'Iniciando stream de {symbol}...')
    streamer = LiveStreamer(symbol, 'H1')
    streamer.poll_loop(interval_sec=60)
