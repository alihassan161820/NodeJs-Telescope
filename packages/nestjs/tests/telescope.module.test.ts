import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { Injectable, Inject } from '@nestjs/common';
import { Telescope } from '@node-telescope/core';
import { TelescopeModule } from '../src/telescope.module.js';
import { TELESCOPE_INSTANCE, TELESCOPE_OPTIONS } from '../src/telescope.constants.js';
import type { TelescopeModuleOptions, TelescopeOptionsFactory } from '../src/telescope.interfaces.js';

describe('TelescopeModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  // ── forRoot ──────────────────────────────────────────────────────────

  it('should create module with forRoot and default config', async () => {
    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot()],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope).toBeDefined();
    expect(telescope).toBeInstanceOf(Telescope);
  });

  it('should create module with forRoot and custom config', async () => {
    module = await Test.createTestingModule({
      imports: [
        TelescopeModule.forRoot({
          enabled: true,
          path: '/__custom-telescope',
        }),
      ],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope).toBeDefined();
    expect(telescope.config.path).toBe('/__custom-telescope');
  });

  it('should provide TELESCOPE_OPTIONS token', async () => {
    const config: TelescopeModuleOptions = { enabled: true, path: '/__test' };

    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot(config)],
    }).compile();

    const options = module.get(TELESCOPE_OPTIONS);
    expect(options).toBeDefined();
    expect(options.path).toBe('/__test');
  });

  it('should provide Telescope instance that is injectable', async () => {
    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot({ enabled: true })],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope).toBeDefined();
    expect(typeof telescope.isRecording).toBe('function');
    expect(typeof telescope.pause).toBe('function');
    expect(typeof telescope.resume).toBe('function');
  });

  it('should use provided storage when configured', async () => {
    const mockStorage = {
      store: async () => {},
      storeBatch: async () => {},
      find: async () => null,
      query: async () => ({ entries: [], hasMore: false }),
      findByBatchId: async () => [],
      prune: async () => 0,
      truncate: async () => {},
      close: async () => {},
    };

    module = await Test.createTestingModule({
      imports: [
        TelescopeModule.forRoot({
          enabled: true,
          storage: mockStorage,
        }),
      ],
    }).compile();

    await module.init();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope.getStorage()).toBe(mockStorage);
  });

  // ── forRootAsync ─────────────────────────────────────────────────────

  it('should create module with forRootAsync using useFactory', async () => {
    module = await Test.createTestingModule({
      imports: [
        TelescopeModule.forRootAsync({
          useFactory: () => ({
            enabled: true,
            path: '/__async-telescope',
          }),
        }),
      ],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope).toBeDefined();
    expect(telescope.config.path).toBe('/__async-telescope');
  });

  it('should support forRootAsync useFactory with inject', async () => {
    const CONFIG_TOKEN = 'TEST_CONFIG';

    // Create a module that provides the config value, then import it
    // into forRootAsync so the factory can resolve the dependency
    const ConfigModule = {
      module: class TestConfigModule {},
      providers: [{ provide: CONFIG_TOKEN, useValue: '/__injected-path' }],
      exports: [CONFIG_TOKEN],
      global: true,
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule as any,
        TelescopeModule.forRootAsync({
          imports: [ConfigModule as any],
          useFactory: (configValue: string) => ({
            enabled: true,
            path: configValue,
          }),
          inject: [CONFIG_TOKEN],
        }),
      ],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope.config.path).toBe('/__injected-path');
  });

  it('should support forRootAsync with useClass', async () => {
    @Injectable()
    class TestTelescopeConfigService implements TelescopeOptionsFactory {
      createTelescopeOptions(): TelescopeModuleOptions {
        return {
          enabled: true,
          path: '/__class-config',
        };
      }
    }

    module = await Test.createTestingModule({
      imports: [
        TelescopeModule.forRootAsync({
          useClass: TestTelescopeConfigService,
        }),
      ],
    }).compile();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope.config.path).toBe('/__class-config');
  });

  // ── Lifecycle ────────────────────────────────────────────────────────

  it('should start telescope on module init', async () => {
    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot({ enabled: true })],
    }).compile();

    await module.init();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope.isRecording()).toBe(true);
    // Watchers should be registered after start
    expect(telescope.watchers.registeredTypes().length).toBeGreaterThan(0);
  });

  it('should stop telescope on module destroy', async () => {
    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot({ enabled: true })],
    }).compile();

    await module.init();

    const telescope = module.get<Telescope>(TELESCOPE_INSTANCE);
    expect(telescope.watchers.registeredTypes().length).toBeGreaterThan(0);

    await module.close();

    // After close, watchers should be unregistered
    expect(telescope.watchers.registeredTypes().length).toBe(0);

    // Prevent double-close in afterEach
    module = undefined as unknown as TestingModule;
  });

  // ── Global module ────────────────────────────────────────────────────

  it('should be a global module (Telescope is injectable anywhere)', async () => {
    @Injectable()
    class TestServiceWithInject {
      constructor(
        @Inject(TELESCOPE_INSTANCE)
        public readonly telescope: Telescope,
      ) {}
    }

    module = await Test.createTestingModule({
      imports: [TelescopeModule.forRoot({ enabled: true })],
      providers: [TestServiceWithInject],
    }).compile();

    const service = module.get(TestServiceWithInject);
    expect(service.telescope).toBeDefined();
    expect(service.telescope).toBeInstanceOf(Telescope);
  });
});
