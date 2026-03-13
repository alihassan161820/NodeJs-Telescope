# @node-telescope/fastify

Fastify plugin for Node Telescope -- a debugging and monitoring dashboard for Node.js.

## Install

```bash
npm install @node-telescope/fastify @node-telescope/storage-sqlite
```

## Quick Start

```ts
import Fastify from 'fastify';
import { telescopePlugin } from '@node-telescope/fastify';

const app = Fastify();
await app.register(telescopePlugin);

await app.listen({ port: 3000 });
// Dashboard: http://localhost:3000/__telescope
```

Zero config. SQLite auto-creates, all watchers enabled, dashboard served at `/__telescope`.

## Configuration

```ts
import { EntryType } from '@node-telescope/core';

await app.register(telescopePlugin, {
  enabled: true,
  path: '/__telescope',
  databasePath: './telescope.sqlite',
  pruneHours: 24,
  ignorePaths: ['/__telescope', '/health'],
  hiddenRequestHeaders: ['authorization', 'cookie', 'set-cookie'],
  hiddenRequestParameters: ['password', 'token', 'secret'],
  watchers: [
    { type: EntryType.Request, enabled: true },
    { type: EntryType.Query, enabled: false },
  ],
});
```

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
