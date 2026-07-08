const express = require('express');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3000;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisicoes HTTP recebidas',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status: res.statusCode };
    httpRequestsTotal.inc(labels);
    end(labels);
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ ok: true, endpoints: ['/fast', '/slow', '/cpu', '/error', '/metrics'] });
});

app.get('/fast', (req, res) => {
  res.json({ route: 'fast', ms: 0 });
});

app.get('/slow', (req, res) => {
  const ms = req.query.ms ? Number(req.query.ms) : Math.floor(100 + Math.random() * 700);
  setTimeout(() => res.json({ route: 'slow', ms }), ms);
});

// Simula "query" cara: trabalho de CPU bloqueando o event loop, tipo uma query mal indexada
app.get('/cpu', (req, res) => {
  const iterations = req.query.n ? Number(req.query.n) : 2_000_000;
  let acc = 0;
  for (let i = 0; i < iterations; i++) {
    acc += Math.sqrt(i) % 7;
  }
  res.json({ route: 'cpu', iterations, result: acc });
});

app.get('/error', (req, res) => {
  if (Math.random() < 0.3) {
    res.status(500).json({ error: 'falha simulada' });
  } else {
    res.json({ route: 'error', ok: true });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(port, () => {
  console.log(`docker-lab-api ouvindo na porta ${port}`);
});
