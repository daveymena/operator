import { Router } from 'express';

const router = Router();
const API_KEY = process.env.MT4_API_KEY || 'trading-bot-key-2024';

const state = {
  connected: false,
  lastTick: null,
  lastCandle: null,
  candles: {},
  account: { balance: 0, equity: 0, margin: 0, freeMargin: 0 },
  positions: [],
  trades: [],
  orders: [],
};

function auth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

router.use(auth);

router.post('/tick', (req, res) => {
  const { symbol, bid, ask, balance, equity, time } = req.body;
  state.connected = true;
  state.lastTick = { symbol, bid, ask, time };
  if (balance) state.account.balance = balance;
  if (equity) state.account.equity = equity;
  res.json({ ok: true, action: 'none' });
});

router.post('/candles', (req, res) => {
  const { symbol, candles, timeframe } = req.body;
  if (candles) {
    state.candles[symbol] = candles;
  }
  state.connected = true;
  res.json({ ok: true, received: candles?.length || 0 });
});

router.post('/candle', (req, res) => {
  const { symbol, candle } = req.body;
  if (symbol && candle) {
    if (!state.candles[symbol]) state.candles[symbol] = [];
    state.candles[symbol].push(candle);
    if (state.candles[symbol].length > 500) {
      state.candles[symbol] = state.candles[symbol].slice(-500);
    }
    state.lastCandle = { symbol, ...candle };
  }
  state.connected = true;
  res.json({ ok: true });
});

router.post('/trade', (req, res) => {
  const { symbol, type, volume, price, sl, tp, magic } = req.body;
  const tradeId = `mt_${Date.now()}`;
  state.orders.push({
    tradeId, symbol, type, volume, price, sl, tp, magic,
    openedAt: new Date().toISOString(),
  });
  res.json({ ok: true, tradeId });
});

router.post('/account', (req, res) => {
  const { balance, equity, margin, freeMargin } = req.body;
  state.account = { balance, equity, margin, freeMargin };
  state.connected = true;
  res.json({ ok: true });
});

router.post('/sync', (req, res) => {
  const { symbol, positions } = req.body;
  if (positions) state.positions = positions;
  state.connected = true;
  res.json({ ok: true });
});

router.get('/signals', (req, res) => {
  const symbol = req.query.symbol || 'EURUSD';
  res.json({
    ok: true,
    symbol,
    signal: null,
    state: {
      connected: state.connected,
      hasCandles: !!state.candles[symbol]?.length,
      positions: state.positions.length,
      balance: state.account.balance,
    },
  });
});

router.post('/order-result', (req, res) => {
  const { ticket, symbol, type, volume, openPrice, closePrice, profit, comment } = req.body;
  state.trades.push({
    ticket, symbol, type, volume, openPrice, closePrice, profit, comment,
    closedAt: new Date().toISOString(),
  });
  if (state.trades.length > 200) state.trades = state.trades.slice(-200);
  res.json({ ok: true });
});

router.get('/status', (req, res) => {
  res.json({
    connected: state.connected,
    lastTick: state.lastTick,
    lastCandle: state.lastCandle,
    account: state.account,
    positions: state.positions.length,
    trades: state.trades.length,
    candles: Object.fromEntries(
      Object.entries(state.candles).map(([k, v]) => [k, v.length])
    ),
  });
});

router.get('/debug', (req, res) => {
  res.json({
    status: 'connected',
    serverTime: new Date().toISOString(),
    version: '2.0.0',
    uptime: process.uptime(),
    state: {
      connected: state.connected,
      account: state.account,
      positions: state.positions.length,
      trades: state.trades.length,
    },
  });
});

export default router;
export { state };
