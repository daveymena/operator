import express from 'express';
import cors from 'cors';

const PORT = parseInt(process.env.OPERATOR_API_PORT || '3001');
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.get('/api/status', (_, res) => {
  res.json({ running: false, mode: 'web-operator-stub', message: 'Web Operator no disponible sin proyecto externo' });
});

app.get('/api/browser', (_, res) => {
  res.json({ running: false, message: 'Browser controller no disponible' });
});

app.post('/api/run', (_, res) => {
  res.json({ ok: false, error: 'Web Operator no disponible' });
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'web-operator-stub' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[web-operator] Stub corriendo en puerto ${PORT}`);
});
