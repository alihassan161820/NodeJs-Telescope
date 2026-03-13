# @node-telescope/nestjs

NestJS module for Node Telescope -- a debugging and monitoring dashboard for Node.js.

## Install

```bash
npm install @node-telescope/nestjs @node-telescope/storage-sqlite
```

## Quick Start

```ts
import { Module } from '@nestjs/common';
import { TelescopeModule } from '@node-telescope/nestjs';

@Module({
  imports: [TelescopeModule.forRoot()],
})
export class AppModule {}
// Dashboard: http://localhost:3000/__telescope
```

## Async Configuration

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

## Injecting Telescope

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

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
