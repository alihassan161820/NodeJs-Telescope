# @node-telescope/express

Express middleware for Node Telescope -- a debugging and monitoring dashboard for Node.js.

## Install

```bash
npm install @node-telescope/express @node-telescope/storage-sqlite
```

## Quick Start

```ts
import express from 'express';
import { telescope } from '@node-telescope/express';

const app = express();
app.use(telescope());

app.listen(3000);
// Dashboard: http://localhost:3000/__telescope
```

Zero config. SQLite auto-creates, all watchers enabled, dashboard served at `/__telescope`.

## Configuration

```ts
import { telescope } from '@node-telescope/express';
import { EntryType } from '@node-telescope/core';

app.use(telescope({
  enabled: true,
  path: '/__telescope',
  databasePath: './telescope.sqlite',
  pruneHours: 24,
  ignorePaths: ['/__telescope', '/health'],
  gate: (req) => req.headers['x-admin-token'] === 'secret',
  hiddenRequestHeaders: ['authorization', 'cookie', 'set-cookie'],
  hiddenRequestParameters: ['password', 'token', 'secret'],
  watchers: [
    { type: EntryType.Request, enabled: true },
    { type: EntryType.Query, enabled: false },
  ],
}));
```

## Using PostgreSQL or MongoDB

```ts
import { telescope } from '@node-telescope/express';
import { PostgresStorage } from '@node-telescope/storage-postgres';

const storage = new PostgresStorage('postgresql://user:pass@localhost:5432/mydb');
await storage.initialize();

app.use(telescope({ storage }));
```

```ts
import { MongoStorage } from '@node-telescope/storage-mongodb';

const storage = new MongoStorage('mongodb://localhost:27017', 'telescope');
app.use(telescope({ storage }));
```

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
