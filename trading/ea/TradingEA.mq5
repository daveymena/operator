//+------------------------------------------------------------------+
//|                                            TradingEA.mq5         |
//|                                    EmaWilliams + IA Filter       |
//+------------------------------------------------------------------+
#property copyright "Trading System"
#property version   "1.00"
#property description "EmaWilliams Strategy with AI Neural Filter"
#property description "Connects to local API server"

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>
#include <Trade\AccountInfo.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\OrderInfo.mqh>
#include <Json.mqh>

input string InpServerUrl = "http://localhost:3000";
input string InpApiKey = "trading-bot-key-2024";
input double InpLotSize = 0.1;
input int InpMagicNumber = 202401;
input bool InpUseAI = true;
input ENUM_TIMEFRAMES InpTimeframe = PERIOD_H1;

CTrade trade;
CPositionInfo position;
CAccountInfo account;
CSymbolInfo symbolInfo;
COrderInfo order;

string symbol;
int serverHandle;
datetime lastBarTime = 0;
double lastBid = 0, lastAsk = 0;
int tickCounter = 0;

//+------------------------------------------------------------------+
int OnInit() {
   symbol = _Symbol;
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(50);

   Print("Inicializado: ", symbol);
   Print("Servidor: ", InpServerUrl);

   SendInitialCandles();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   Print("Detenido: ", reason);
}

//+------------------------------------------------------------------+
void OnTick() {
   tickCounter++;

   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   lastBid = bid; lastAsk = ask;

   if (tickCounter % 10 == 0) {
      SendTick(bid, ask);
   }

   if (IsNewBar()) {
      SendCandle();
      CheckForSignals();
   }

   if (tickCounter % 30 == 0) {
      SyncPositions();
   }

   ManagePositions();
}

//+------------------------------------------------------------------+
bool IsNewBar() {
   datetime currentBarTime = iTime(symbol, InpTimeframe, 0);
   if (currentBarTime != lastBarTime) {
      lastBarTime = currentBarTime;
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
string GetCandlesJSON(int count = 200) {
   string result = "[";
   for (int i = count - 1; i >= 0; i--) {
      datetime time = iTime(symbol, InpTimeframe, i);
      double open = iOpen(symbol, InpTimeframe, i);
      double high = iHigh(symbol, InpTimeframe, i);
      double low = iLow(symbol, InpTimeframe, i);
      double close = iClose(symbol, InpTimeframe, i);
      long volume = iVolume(symbol, InpTimeframe, i);
      result += StringFormat("{\"timestamp\":\"%s\",\"open\":%f,\"high\":%f,\"low\":%f,\"close\":%f,\"tick_volume\":%d},",
         TimeToString(time, TIME_DATE|TIME_MINUTES), open, high, low, close, volume);
   }
   StringSetCharacter(result, StringLen(result) - 1, ']');
   return result;
}

//+------------------------------------------------------------------+
void SendInitialCandles() {
   string candles = GetCandlesJSON(200);
   string body = StringFormat("{\"symbol\":\"%s\",\"candles\":%s,\"timeframe\":\"H1\"}", symbol, candles);
   WebRequest("POST", InpServerUrl + "/api/bridge/candles", InpApiKey, body);
}

//+------------------------------------------------------------------+
void SendTick(double bid, double ask) {
   string body = StringFormat(
      "{\"symbol\":\"%s\",\"bid\":%f,\"ask\":%f,\"balance\":%.2f,\"equity\":%.2f,\"time\":\"%s\"}",
      symbol, bid, ask, account.Balance(), account.Equity(), TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS));
   WebRequest("POST", InpServerUrl + "/api/bridge/tick", InpApiKey, body);
}

//+------------------------------------------------------------------+
void SendCandle() {
   datetime time = iTime(symbol, InpTimeframe, 0);
   double open = iOpen(symbol, InpTimeframe, 0);
   double high = iHigh(symbol, InpTimeframe, 0);
   double low = iLow(symbol, InpTimeframe, 0);
   double close = iClose(symbol, InpTimeframe, 0);
   long volume = iVolume(symbol, InpTimeframe, 0);

   string body = StringFormat(
      "{\"symbol\":\"%s\",\"candle\":{\"timestamp\":\"%s\",\"open\":%f,\"high\":%f,\"low\":%f,\"close\":%f,\"tick_volume\":%d}}",
      symbol, TimeToString(time, TIME_DATE|TIME_MINUTES), open, high, low, close, volume);
   WebRequest("POST", InpServerUrl + "/api/bridge/candle", InpApiKey, body);
}

//+------------------------------------------------------------------+
void CheckForSignals() {
   string response = WebRequest("GET", InpServerUrl + "/api/signals?symbol=" + symbol, InpApiKey, "");
   if (response == "") return;

   // Parse response for signal
   if (StringFind(response, "\"type\":\"buy\"") >= 0 || StringFind(response, "\"type\":\"sell\"") >= 0) {
      bool isBuy = StringFind(response, "\"type\":\"buy\"") >= 0;
      double entry = isBuy ? lastAsk : lastBid;
      double sl = 0, tp = 0;

      int slPos = StringFind(response, "\"sl\":");
      if (slPos >= 0) sl = StringToDouble(StringSubstr(response, slPos + 5, 10));

      int tpPos = StringFind(response, "\"tp\":");
      if (tpPos >= 0) tp = StringToDouble(StringSubstr(response, tpPos + 5, 10));

      if (sl == 0 || tp == 0) return;

      if (isBuy) {
         trade.Buy(InpLotSize, symbol, entry, sl, tp, "AI Signal");
      } else {
         trade.Sell(InpLotSize, symbol, entry, sl, tp, "AI Signal");
      }
   }
}

//+------------------------------------------------------------------+
void SyncPositions() {
   int total = PositionsTotal();
   string body = "{\"positions\":[";
   for (int i = 0; i < total; i++) {
      if (position.SelectByIndex(i)) {
         body += StringFormat(
            "{\"ticket\":%d,\"symbol\":\"%s\",\"type\":%d,\"volume\":%f,\"openPrice\":%f,\"currentPrice\":%f,\"profit\":%f,\"swap\":%f},",
            position.Ticket(), position.Symbol(), position.PositionType(),
            position.Volume(), position.PriceOpen(), position.PriceCurrent(),
            position.Profit(), position.Swap());
      }
   }
   if (total > 0) StringSetCharacter(body, StringLen(body) - 1, ']');
   else body += "]";
   body = StringFormat("{\"symbol\":\"%s\",\"positions\":%s}", symbol, body);
   WebRequest("POST", InpServerUrl + "/api/bridge/sync", InpApiKey, body);
}

//+------------------------------------------------------------------+
void ManagePositions() {
   for (int i = PositionsTotal() - 1; i >= 0; i--) {
      if (position.SelectByIndex(i)) {
         if (position.Symbol() != symbol) continue;
         if (position.Magic() != InpMagicNumber) continue;

         double profit = position.Profit();
         double openPrice = position.PriceOpen();
         double currentPrice = position.PriceCurrent();
         double sl = position.StopLoss();
         double risk = MathAbs(openPrice - sl) * 10000;

         if (profit > 0 && risk > 0) {
            double rMultiple = (position.PositionType() == POSITION_TYPE_BUY)
               ? (currentPrice - openPrice) / (openPrice - sl)
               : (openPrice - currentPrice) / (sl - openPrice);

            if (rMultiple >= 1.0 && sl < openPrice) {
               trade.PositionModify(position.Ticket(), openPrice + 5 * _Point, position.TakeProfit());
               Print("Breakeven activado para ticket ", position.Ticket());
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
string WebRequest(string method, string url, string apiKey, string body) {
   char data[];
   char result[];
   string resultHeaders;
   int timeout = 5000;

   if (body != "") {
      StringToCharArray(body, data);
   }

   ResetLastError();
   int res = WebRequest(method, url, apiKey, "", timeout, data, result, resultHeaders);

   if (res == -1) {
      int err = GetLastError();
      if (err != 0) Print("WebRequest error: ", err);
      return "";
   }

   return CharArrayToString(result);
}

//+------------------------------------------------------------------+
double GetSpread() {
   return SymbolInfoInteger(symbol, SYMBOL_SPREAD) * _Point;
}
//+------------------------------------------------------------------+
