# @node-telescope/core

Core engine for Node Telescope -- includes 18 watchers, types, and security utilities.

> Most users should install a framework adapter instead:
> [`@node-telescope/express`](https://npmjs.com/package/@node-telescope/express),
> [`@node-telescope/nestjs`](https://npmjs.com/package/@node-telescope/nestjs), or
> [`@node-telescope/fastify`](https://npmjs.com/package/@node-telescope/fastify).

## Install

```bash
npm install @node-telescope/core
```

## Usage

### EntryType enum

```ts
import { EntryType } from '@node-telescope/core';

// Available entry types:
// EntryType.Request, EntryType.Exception, EntryType.Log,
// EntryType.Query, EntryType.Model, EntryType.Event,
// EntryType.Job, EntryType.Mail, EntryType.Notification,
// EntryType.Cache, EntryType.Redis, EntryType.Gate,
// EntryType.HttpClient, EntryType.Command, EntryType.Schedule,
// EntryType.Dump, EntryType.Batch, EntryType.View
```

### Recording watchers manually

```ts
import { Telescope, QueryWatcher, EntryType } from '@node-telescope/core';

const queryWatcher = telescope.watchers.get<QueryWatcher>(EntryType.Query);
queryWatcher?.recordQuery(telescope, {
  connection: 'postgresql',
  sql: 'SELECT * FROM users WHERE id = $1',
  bindings: [42],
  duration: 12.5,
});
```

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
