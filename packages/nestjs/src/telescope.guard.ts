// TelescopeAuthGuard — NestJS guard that checks the config.gate authorization function
// If no gate is configured, access is allowed by default (matches Laravel Telescope behavior)

import { Injectable, type CanActivate, type ExecutionContext, Inject } from '@nestjs/common';
import type { Telescope } from '@node-telescope/core';
import { TELESCOPE_INSTANCE } from './telescope.constants.js';

@Injectable()
export class TelescopeAuthGuard implements CanActivate {
  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gate = this.telescope.config.gate;
    if (!gate) {
      return true;
    }

    try {
      const request = context.switchToHttp().getRequest();
      const result = await gate(request);
      return !!result;
    } catch (error) {
      console.warn('[Telescope] Gate check error:', error);
      return false;
    }
  }
}
