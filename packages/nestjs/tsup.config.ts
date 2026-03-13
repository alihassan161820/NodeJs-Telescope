import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'rxjs',
    'ws',
    '@node-telescope/core',
    '@node-telescope/storage-sqlite',
    '@node-telescope/dashboard',
    'express',
    'reflect-metadata',
  ],
});
