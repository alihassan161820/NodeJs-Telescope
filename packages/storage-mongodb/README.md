# @node-telescope/storage-mongodb

MongoDB storage driver for Node Telescope.

## Install

```bash
npm install @node-telescope/storage-mongodb
```

## Usage

```ts
import { telescope } from '@node-telescope/express';
import { MongoStorage } from '@node-telescope/storage-mongodb';

const storage = new MongoStorage('mongodb://localhost:27017', 'telescope');

app.use(telescope({ storage }));
```

The first argument is the MongoDB connection string and the second is the database name. Collections and TTL indexes are created automatically.

### With NestJS

```ts
import { MongoStorage } from '@node-telescope/storage-mongodb';

@Module({
  imports: [
    TelescopeModule.forRootAsync({
      useFactory: () => {
        const storage = new MongoStorage('mongodb://localhost:27017', 'telescope');
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
