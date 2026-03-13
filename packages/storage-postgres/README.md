# @node-telescope/storage-postgres

PostgreSQL storage driver for Node Telescope.

## Install

```bash
npm install @node-telescope/storage-postgres
```

## Usage

```ts
import { telescope } from '@node-telescope/express';
import { PostgresStorage } from '@node-telescope/storage-postgres';

const storage = new PostgresStorage('postgresql://user:pass@localhost:5432/mydb');
await storage.initialize();

app.use(telescope({ storage }));
```

The `initialize()` call creates the required tables automatically. Uses JSONB columns and connection pooling for production workloads.

### With NestJS

```ts
import { PostgresStorage } from '@node-telescope/storage-postgres';

@Module({
  imports: [
    TelescopeModule.forRootAsync({
      useFactory: async () => {
        const storage = new PostgresStorage('postgresql://user:pass@localhost:5432/mydb');
        await storage.initialize();
        return { storage };
      },
    }),
  ],
})
export class AppModule {}
```

## Documentation

See the [main Node Telescope README](https://github.com/AliHassan/node-telescope#readme) for full documentation.

## License

MIT
