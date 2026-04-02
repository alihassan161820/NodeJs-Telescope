# Node Telescope

**Laravel Telescope for the Node.js ecosystem.** A debugging and monitoring dashboard that gives you full visibility into your application's requests, exceptions, logs, queries, and more.

[![npm version](https://img.shields.io/npm/v/@node-telescope/core.svg)](https://www.npmjs.com/package/@node-telescope/core)
[![npm downloads](https://img.shields.io/npm/dm/@node-telescope/core.svg)](https://www.npmjs.com/package/@node-telescope/core)
[![CI](https://github.com/alihassan161820/NodeJs-Telescope/actions/workflows/ci.yml/badge.svg)](https://github.com/alihassan161820/NodeJs-Telescope/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

---

## Screenshots

### Requests Dashboard
![Requests List](docs/screenshots/requests-list.png)

### Request Replay
Replay any captured request directly from the dashboard. Click "Replay Request" to re-send it to your server and see the live response.

![Request Detail with Replay](docs/screenshots/request-detail-replay.png)

### Queries with Slow Query Detection
![Queries List](docs/screenshots/queries-list.png)

### Job Queue Monitoring
![Jobs List](docs/screenshots/jobs-list.png)

---

## Quick Start

### Express

```bash
npm install @node-telescope/express @node-telescope/storage-sqlite
```

```ts
import express from 'express';
import { telescope } from '@node-telescope/express';

const app = express();
app.use(telescope());

app.listen(3000);
// Dashboard: http://localhost:3000/__telescope
```

### NestJS

```bash
npm install @node-telescope/nestjs @node-telescope/storage-sqlite
```

```ts
import { Module } from '@nestjs/common';
import { TelescopeModule } from '@node-telescope/nestjs';

@Module({
  imports: [TelescopeModule.forRoot()],
})
export class AppModule {}
// Dashboard: http://localhost:3000/__telescope
```

### Fastify

```bash
npm install @node-telescope/fastify @node-telescope/storage-sqlite
```

```ts
import Fastify from 'fastify';
import { telescopePlugin } from '@node-telescope/fastify';

const app = Fastify();
await app.register(telescopePlugin);

await app.listen({ port: 3000 });
// Dashboard: http://localhost:3000/__telescope
```

That's it. Zero config. SQLite auto-creates, all watchers enabled, dashboard served at `/__telescope`.

---

## Features

### 18 Watchers (mirrors Laravel Telescope 1:1)

| Watcher | What it captures |
|---------|-----------------|
| **Request** | HTTP requests, responses, status codes, duration |
| **Exception** | Uncaught exceptions and unhandled rejections |
| **Log** | `console.log/info/warn/error/debug` calls |
| **Query** | Database queries with duration and slow query detection |
| **Model** | ORM model events (created, updated, deleted) |
| **Event** | Application events and listeners |
| **Job** | Background job execution (queues) |
| **Mail** | Outgoing email with recipients and content |
| **Notification** | Notification dispatch across channels |
| **Cache** | Cache hits, misses, writes, and forgets |
| **Redis** | Redis commands with duration |
| **Gate** | Authorization checks (allowed/denied) |
| **HTTP Client** | Outgoing HTTP requests (fetch, axios) |
| **Command** | CLI command execution with exit codes |
| **Schedule** | Scheduled task runs with cron expressions |
| **Dump** | Debug dump output with file/line info |
| **Batch** | Batch operation tracking with job counts |
| **View** | Template rendering with data keys |

### 3 Framework Adapters

- **Express** (`@node-telescope/express`) - Middleware-based, Express 4 & 5
- **NestJS** (`@node-telescope/nestjs`) - Module with interceptors, NestJS 10 & 11
- **Fastify** (`@node-telescope/fastify`) - Plugin with hooks, Fastify 5

### 3 Storage Drivers

- **SQLite** (`@node-telescope/storage-sqlite`) - Zero-config default, great for development
- **PostgreSQL** (`@node-telescope/storage-postgres`) - Production-ready with JSONB and connection pooling
- **MongoDB** (`@node-telescope/storage-mongodb`) - Document storage with TTL indexes

### Dashboard

- React 19 SPA with Tailwind CSS
- Pages for all 18 watcher types
- Real-time updates via WebSocket
- **Request Replay** -- re-send any captured request and see the live response
- Recording toggle (pause/resume)
- Entry clearing
- Batch correlation (see all entries from a single request)

---

## Configuration

All options are optional with sensible defaults:

```ts
import { telescope } from '@node-telescope/express';
import { EntryType } from '@node-telescope/core';

app.use(telescope({
  // Enable/disable. Default: true in dev, false in production
  enabled: true,

  // Dashboard URL path. Default: '/__telescope'
  path: '/__telescope',

  // SQLite database path. Default: './telescope.sqlite'
  databasePath: './telescope.sqlite',

  // Auto-prune entries older than N hours. Default: 24
  pruneHours: 24,

  // Paths to exclude from recording. Default: ['/__telescope']
  ignorePaths: ['/__telescope', '/health'],

  // Authorization gate for dashboard access
  gate: (req) => {
    return req.headers['x-admin-token'] === 'secret';
  },

  // Filter which entries get recorded
  recordingFilter: (entry) => {
    // Skip health check requests
    if (entry.content.path === '/health') return false;
    return true;
  },

  // Headers to mask in stored entries. Default: ['authorization', 'cookie', 'set-cookie']
  hiddenRequestHeaders: ['authorization', 'cookie', 'set-cookie'],

  // Body fields to mask. Default: ['password', 'token', 'secret', 'credit_card']
  hiddenRequestParameters: ['password', 'token', 'secret', 'credit_card', 'ssn'],

  // Selectively enable/disable watchers
  watchers: [
    { type: EntryType.Request, enabled: true },
    { type: EntryType.Log, enabled: true },
    { type: EntryType.Exception, enabled: true },
    { type: EntryType.Query, enabled: false }, // disable query watcher
  ],
}));
```

---

## Storage Drivers

### SQLite (default)

Automatically used when `@node-telescope/storage-sqlite` is installed. No configuration needed.

```bash
npm install @node-telescope/storage-sqlite
```

### PostgreSQL

```bash
npm install @node-telescope/storage-postgres
```

```ts
import { telescope } from '@node-telescope/express';
import { PostgresStorage } from '@node-telescope/storage-postgres';

const storage = new PostgresStorage('postgresql://user:pass@localhost:5432/mydb');
await storage.initialize();

app.use(telescope({ storage }));
```

### MongoDB

```bash
npm install @node-telescope/storage-mongodb
```

```ts
import { telescope } from '@node-telescope/express';
import { MongoStorage } from '@node-telescope/storage-mongodb';

const storage = new MongoStorage('mongodb://localhost:27017', 'telescope');

app.use(telescope({ storage }));
```

---

## NestJS Advanced Usage

### Async configuration

```ts
@Module({
  imports: [
    TelescopeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        enabled: config.get('TELESCOPE_ENABLED', true),
        databasePath: config.get('TELESCOPE_DB_PATH', './telescope.sqlite'),
      }),
    }),
  ],
})
export class AppModule {}
```

### Injecting Telescope

```ts
import { Injectable } from '@nestjs/common';
import { Telescope } from '@node-telescope/core';

@Injectable()
export class MyService {
  constructor(private readonly telescope: Telescope) {}

  doWork() {
    // Telescope instance is available for manual recording
  }
}
```

---

## Recording Watchers Manually

Many watchers are "passive" - they provide a `record*` method that your application or ORM adapter calls:

```ts
import { Telescope, QueryWatcher, EntryType } from '@node-telescope/core';

// Record a database query (e.g., from a Prisma middleware)
const queryWatcher = telescope.watchers.get<QueryWatcher>(EntryType.Query);
queryWatcher?.recordQuery(telescope, {
  connection: 'postgresql',
  sql: 'SELECT * FROM users WHERE id = $1',
  bindings: [42],
  duration: 12.5,
});

// Record an outgoing HTTP request (e.g., from an axios interceptor)
const httpWatcher = telescope.watchers.get<HttpClientWatcher>(EntryType.HttpClient);
httpWatcher?.recordHttpClient(telescope, {
  method: 'GET',
  url: 'https://api.example.com/users',
  headers: {},
  statusCode: 200,
  duration: 150,
});
```

---

## Security

Node Telescope is secure by default:

- **Auto-disabled in production** - `enabled` defaults to `process.env.NODE_ENV !== 'production'`
- **PII masking** - Passwords, tokens, secrets, credit card numbers are automatically masked in stored data
- **Header filtering** - Authorization, Cookie, and Set-Cookie headers are masked by default
- **Authorization gate** - Restrict dashboard access with a custom gate function
- **CSP headers** - Dashboard serves Content-Security-Policy headers
- **No eval** - Dashboard is a pre-built static SPA, no server-side template rendering

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@node-telescope/core` | Core engine, watchers, security (0 runtime deps) | [![npm](https://img.shields.io/npm/v/@node-telescope/core)](https://npmjs.com/package/@node-telescope/core) |
| `@node-telescope/express` | Express middleware adapter | [![npm](https://img.shields.io/npm/v/@node-telescope/express)](https://npmjs.com/package/@node-telescope/express) |
| `@node-telescope/nestjs` | NestJS module adapter | [![npm](https://img.shields.io/npm/v/@node-telescope/nestjs)](https://npmjs.com/package/@node-telescope/nestjs) |
| `@node-telescope/fastify` | Fastify plugin adapter | [![npm](https://img.shields.io/npm/v/@node-telescope/fastify)](https://npmjs.com/package/@node-telescope/fastify) |
| `@node-telescope/storage-sqlite` | SQLite storage driver | [![npm](https://img.shields.io/npm/v/@node-telescope/storage-sqlite)](https://npmjs.com/package/@node-telescope/storage-sqlite) |
| `@node-telescope/storage-postgres` | PostgreSQL storage driver | [![npm](https://img.shields.io/npm/v/@node-telescope/storage-postgres)](https://npmjs.com/package/@node-telescope/storage-postgres) |
| `@node-telescope/storage-mongodb` | MongoDB storage driver | [![npm](https://img.shields.io/npm/v/@node-telescope/storage-mongodb)](https://npmjs.com/package/@node-telescope/storage-mongodb) |
| `@node-telescope/dashboard` | Pre-built React dashboard | [![npm](https://img.shields.io/npm/v/@node-telescope/dashboard)](https://npmjs.com/package/@node-telescope/dashboard) |

---

## Development

```bash
# Clone and install
git clone https://github.com/alihassan161820/NodeJs-Telescope.git
cd node-telescope
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint
pnpm lint

# Run the example app
cd examples/express-basic
pnpm dev
```

### Project Structure

```
packages/
  core/             # Engine, 18 watchers, security, types (0 deps)
  storage-sqlite/   # SQLite storage driver
  storage-postgres/ # PostgreSQL storage driver
  storage-mongodb/  # MongoDB storage driver
  express/          # Express middleware adapter
  nestjs/           # NestJS module adapter
  fastify/          # Fastify plugin adapter
  dashboard/        # React 19 + Tailwind CSS SPA
examples/
  express-basic/    # Minimal Express example
```

---

## Comparison with Laravel Telescope

| Feature | Laravel Telescope | Node Telescope |
|---------|:-:|:-:|
| Request monitoring | Yes | Yes |
| Exception tracking | Yes | Yes |
| Log capturing | Yes | Yes |
| Database queries | Yes | Yes |
| Model events | Yes | Yes |
| Events/listeners | Yes | Yes |
| Queue/jobs | Yes | Yes |
| Mail | Yes | Yes |
| Notifications | Yes | Yes |
| Cache | Yes | Yes |
| Redis | Yes | Yes |
| Authorization gates | Yes | Yes |
| HTTP client | Yes | Yes |
| CLI commands | Yes | Yes |
| Schedule | Yes | Yes |
| Dumps | Yes | Yes |
| Batch | Yes | Yes |
| Views | Yes | Yes |
| Real-time dashboard | Yes | Yes (WebSocket) |
| Data pruning | Yes | Yes (auto + manual) |
| Auth gate | Yes | Yes |
| PII masking | Yes | Yes |
| Multiple frameworks | Laravel only | Express, NestJS, Fastify |
| Multiple databases | MySQL/PostgreSQL | SQLite, PostgreSQL, MongoDB |

---

## License

MIT
