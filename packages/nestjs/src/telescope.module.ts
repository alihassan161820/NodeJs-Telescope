// TelescopeModule — NestJS DynamicModule for Node-Telescope
// Provides TelescopeModule.forRoot(config?) and TelescopeModule.forRootAsync(options)
// Auto-resolves storage, registers interceptor globally, manages lifecycle

import {
  Module,
  type DynamicModule,
  type OnModuleInit,
  type OnModuleDestroy,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
  Inject,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Telescope, type StorageRepository } from '@node-telescope/core';
import { TELESCOPE_OPTIONS, TELESCOPE_INSTANCE } from './telescope.constants.js';
import type {
  TelescopeModuleOptions,
  TelescopeModuleAsyncOptions,
  TelescopeOptionsFactory,
} from './telescope.interfaces.js';
import { TelescopeInterceptor } from './telescope.interceptor.js';
import { TelescopeController } from './telescope.controller.js';
import { TelescopeAuthGuard } from './telescope.guard.js';
import { TelescopeGateway } from './telescope.gateway.js';
import { TelescopeDashboardMiddleware } from './telescope.dashboard.js';

/**
 * Tries to auto-resolve and instantiate @node-telescope/storage-sqlite.
 * Returns the storage instance or null if the package is not installed.
 */
async function autoResolveStorage(config: TelescopeModuleOptions): Promise<StorageRepository | null> {
  try {
    const { SqliteStorage } = await import('@node-telescope/storage-sqlite');
    const storage = new SqliteStorage(config.databasePath) as unknown as StorageRepository;
    return storage;
  } catch {
    return null;
  }
}

@Module({})
export class TelescopeModule implements NestModule, OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
    @Inject(TELESCOPE_OPTIONS)
    private readonly options: TelescopeModuleOptions,
  ) {}

  /**
   * Register TelescopeModule synchronously with configuration options.
   *
   * Usage:
   * ```ts
   * TelescopeModule.forRoot({ enabled: true, path: '/__telescope' })
   * ```
   */
  static forRoot(config: TelescopeModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: TELESCOPE_OPTIONS,
      useValue: config,
    };

    const telescopeProvider: Provider = {
      provide: TELESCOPE_INSTANCE,
      useFactory: () => {
        const telescope = new Telescope(config);

        if (config.storage) {
          telescope.setStorage(config.storage);
        }

        return telescope;
      },
    };

    return {
      module: TelescopeModule,
      global: true,
      providers: [
        optionsProvider,
        telescopeProvider,
        TelescopeAuthGuard,
        TelescopeGateway,
        TelescopeDashboardMiddleware,
        {
          provide: APP_INTERCEPTOR,
          useClass: TelescopeInterceptor,
        },
      ],
      controllers: [TelescopeController],
      exports: [TELESCOPE_INSTANCE, TELESCOPE_OPTIONS],
    };
  }

  /**
   * Register TelescopeModule asynchronously.
   * Supports useFactory, useClass, and useExisting patterns.
   *
   * Usage:
   * ```ts
   * TelescopeModule.forRootAsync({
   *   useFactory: (configService) => ({
   *     enabled: configService.get('TELESCOPE_ENABLED'),
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: TelescopeModuleAsyncOptions): DynamicModule {
    const asyncProviders = TelescopeModule.createAsyncProviders(options);

    const telescopeProvider: Provider = {
      provide: TELESCOPE_INSTANCE,
      useFactory: (config: TelescopeModuleOptions) => {
        const telescope = new Telescope(config);

        if (config.storage) {
          telescope.setStorage(config.storage);
        }

        return telescope;
      },
      inject: [TELESCOPE_OPTIONS],
    };

    return {
      module: TelescopeModule,
      global: true,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        telescopeProvider,
        TelescopeAuthGuard,
        TelescopeGateway,
        TelescopeDashboardMiddleware,
        {
          provide: APP_INTERCEPTOR,
          useClass: TelescopeInterceptor,
        },
      ],
      controllers: [TelescopeController],
      exports: [TELESCOPE_INSTANCE, TELESCOPE_OPTIONS],
    };
  }

  /**
   * Configure middleware — mounts the dashboard middleware.
   */
  configure(consumer: MiddlewareConsumer): void {
    const telescopePath = this.telescope.config.path;
    consumer
      .apply(TelescopeDashboardMiddleware)
      .forRoutes(`${telescopePath}`, `${telescopePath}/*`);
  }

  /**
   * Lifecycle: start telescope when the module initializes.
   * Auto-resolves storage if none was provided.
   */
  async onModuleInit(): Promise<void> {
    try {
      // Auto-resolve storage if none configured
      if (!this.options.storage && !this.telescope.getStorage()) {
        const storage = await autoResolveStorage(this.options);
        if (storage) {
          this.telescope.setStorage(storage);
        } else {
          console.warn(
            '[Telescope] No storage configured. Install @node-telescope/storage-sqlite for automatic setup.',
          );
        }
      }

      // Start telescope — register watchers, begin recording
      this.telescope.start();
    } catch (error) {
      console.warn('[Telescope] Module init error:', error);
    }
  }

  /**
   * Lifecycle: stop telescope when the module is destroyed.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.telescope.stop();
    } catch (error) {
      console.warn('[Telescope] Module destroy error:', error);
    }
  }

  /**
   * Creates async providers for useFactory, useClass, or useExisting patterns.
   */
  private static createAsyncProviders(options: TelescopeModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: TELESCOPE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: TELESCOPE_OPTIONS,
          useFactory: async (factory: TelescopeOptionsFactory) => factory.createTelescopeOptions(),
          inject: [options.useClass],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: TELESCOPE_OPTIONS,
          useFactory: async (factory: TelescopeOptionsFactory) => factory.createTelescopeOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    // Fallback — empty config
    return [
      {
        provide: TELESCOPE_OPTIONS,
        useValue: {},
      },
    ];
  }
}
