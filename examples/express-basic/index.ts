import express from 'express';
import { telescope } from '@node-telescope/express';

const app = express();
app.use(express.json());

// One line integration — just like Laravel Telescope
app.use(telescope());

// ── Sample routes ────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ message: 'Hello from Node-Telescope example!' });
});

app.get('/users', (_req, res) => {
  console.log('Fetching users...');
  res.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' },
  ]);
});

app.get('/users/:id', (req, res) => {
  const id = Number(req.params['id']);
  const users: Record<number, { id: number; name: string; email: string }> = {
    1: { id: 1, name: 'Alice', email: 'alice@example.com' },
    2: { id: 2, name: 'Bob', email: 'bob@example.com' },
    3: { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  };
  const user = users[id];
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/users', (req, res) => {
  console.log('Creating user:', req.body);
  res.status(201).json({ id: 4, ...req.body });
});

app.post('/login', (req, res) => {
  console.log('Login attempt:', req.body);
  res.json({ success: true, token: 'fake-jwt-token' });
});

app.get('/slow', async (_req, res) => {
  console.log('Starting slow request...');
  await new Promise((r) => setTimeout(r, 1500));
  res.json({ message: 'This was slow!' });
});

app.get('/error', () => {
  throw new Error('Test exception for Telescope');
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: err.message });
});

// ── Start server ─────────────────────────────────────────────────

const PORT = process.env['PORT'] ?? 3000;
app.listen(PORT, () => {
  console.log(`\n  Server running at http://localhost:${PORT}`);
  console.log(`  Telescope dashboard at http://localhost:${PORT}/__telescope\n`);
});
