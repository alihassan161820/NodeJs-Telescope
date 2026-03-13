// Module option interfaces for TelescopeModule.forRoot / forRootAsync
// Follows NestJS DynamicModule conventions for async provider registration

import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import type { TelescopeConfig } from '@node-telescope/core';

/** Synchronous module options — extends TelescopeConfig directly */
export interface TelescopeModuleOptions extends TelescopeConfig {}

/** Factory interface for async options resolution via useClass / useExisting */
export interface TelescopeOptionsFactory {
  createTelescopeOptions(): TelescopeModuleOptions | Promise<TelescopeModuleOptions>;
}

/** Asynchronous module options — supports useFactory, useClass, useExisting */
export interface TelescopeModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Use a factory function to create options */
  useFactory?: (...args: unknown[]) => TelescopeModuleOptions | Promise<TelescopeModuleOptions>;

  /** Inject these providers into the factory function */
  inject?: (InjectionToken | OptionalFactoryDependency)[];

  /** Use a class that implements TelescopeOptionsFactory */
  useClass?: Type<TelescopeOptionsFactory>;

  /** Use an existing provider that implements TelescopeOptionsFactory */
  useExisting?: Type<TelescopeOptionsFactory>;
}
