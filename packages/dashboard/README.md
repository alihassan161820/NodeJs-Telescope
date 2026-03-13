# @node-telescope/dashboard

Pre-built React dashboard for Node Telescope.

> This package is automatically served by framework adapters (`@node-telescope/express`, `@node-telescope/nestjs`, `@node-telescope/fastify`). No manual setup is needed.

## Install

```bash
npm install @node-telescope/dashboard
```

## Overview

- React 19 + Tailwind CSS single-page application
- Served automatically at `/__telescope` by any framework adapter
- Pages for all 18 watcher types
- Real-time updates via WebSocket
- Recording toggle (pause/resume) and entry clearing
- Batch correlation to view all entries from a single request

## How it works

When you install a framework adapter and start your app, the dashboard is served as static assets at the configured path (default: `/__telescope`). You do not need to import or configure this package directly.

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
