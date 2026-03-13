# @node-telescope/storage-sqlite

SQLite storage driver for Node Telescope.

> Auto-detected by framework adapters when installed. Zero configuration needed.

## Install

```bash
npm install @node-telescope/storage-sqlite
```

## Usage

When using a framework adapter (`@node-telescope/express`, `@node-telescope/nestjs`, or `@node-telescope/fastify`), SQLite storage is used automatically if this package is installed. Just install it and you are done:

```ts
import express from 'express';
import { telescope } from '@node-telescope/express';

const app = express();
app.use(telescope());
// SQLite database auto-created at ./telescope.sqlite
```

### Explicit usage

```ts
import { SqliteStorage } from '@node-telescope/storage-sqlite';

const storage = new SqliteStorage('./telescope.sqlite');

app.use(telescope({ storage }));
```

### Custom database path

```ts
app.use(telescope({
  databasePath: './data/telescope.sqlite',
}));
```

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
