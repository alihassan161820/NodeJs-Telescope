// TelescopeController — REST API endpoints for querying and managing telescope entries
// Mirrors the Express api-router: entries CRUD + status toggling
// Mounted at config.path (default /__telescope)

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Inject,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { EntryType, type Telescope, type EntryFilter } from '@node-telescope/core';
import { TELESCOPE_INSTANCE } from './telescope.constants.js';
import { TelescopeAuthGuard } from './telescope.guard.js';

/** Map URL segment names to EntryType enum values */
const ENTRY_TYPE_MAP: Record<string, EntryType> = {
  requests: EntryType.Request,
  exceptions: EntryType.Exception,
  queries: EntryType.Query,
  logs: EntryType.Log,
  models: EntryType.Model,
  events: EntryType.Event,
  jobs: EntryType.Job,
  mail: EntryType.Mail,
  notifications: EntryType.Notification,
  cache: EntryType.Cache,
  redis: EntryType.Redis,
  gates: EntryType.Gate,
  'http-client': EntryType.HttpClient,
  commands: EntryType.Command,
  schedule: EntryType.Schedule,
  schedules: EntryType.Schedule,
  dumps: EntryType.Dump,
  batches: EntryType.Batch,
  views: EntryType.View,
};

@Controller('__telescope')
@UseGuards(TelescopeAuthGuard)
export class TelescopeController {
  constructor(
    @Inject(TELESCOPE_INSTANCE)
    private readonly telescope: Telescope,
  ) {}

  @Get('api/status')
  getStatus(): { recording: boolean } {
    try {
      return { recording: this.telescope.isRecording() };
    } catch (error) {
      console.warn('[Telescope] Status error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('api/status')
  toggleStatus(@Body() body: { recording?: boolean }): { recording: boolean } {
    try {
      if (typeof body?.recording === 'boolean') {
        if (body.recording) {
          this.telescope.resume();
        } else {
          this.telescope.pause();
        }
      }
      return { recording: this.telescope.isRecording() };
    } catch (error) {
      console.warn('[Telescope] Status toggle error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('api/entries')
  async clearEntries(): Promise<{ success: boolean }> {
    try {
      const storage = this.telescope.getStorage();
      if (!storage) {
        throw new HttpException('Storage not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      await storage.truncate();
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.warn('[Telescope] Truncate error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('api/entries/:id/batch')
  async getBatchEntries(@Param('id') id: string): Promise<{ entries: unknown[] }> {
    try {
      const storage = this.telescope.getStorage();
      if (!storage) {
        throw new HttpException('Storage not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const entry = await storage.find(id);
      if (!entry) {
        throw new HttpException('Entry not found', HttpStatus.NOT_FOUND);
      }

      const batchEntries = await storage.findByBatchId(entry.batchId);
      return { entries: batchEntries };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.warn('[Telescope] Batch query error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('api/replay/:id')
  async replayRequest(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<unknown> {
    try {
      const storage = this.telescope.getStorage();
      if (!storage) {
        throw new HttpException('Storage not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const entry = await storage.find(id);
      if (!entry) {
        throw new HttpException('Entry not found', HttpStatus.NOT_FOUND);
      }

      if (entry.type !== EntryType.Request) {
        throw new HttpException('Only request entries can be replayed', HttpStatus.BAD_REQUEST);
      }

      const content = entry.content as Record<string, unknown>;
      const method = String(content['method'] ?? 'GET').toUpperCase();
      const path = String(content['path'] ?? content['url'] ?? '/');
      const headers = (content['headers'] ?? {}) as Record<string, string>;
      const payload = content['payload'];

      const host = req.get('host') ?? 'localhost';
      const protocol = req.protocol;
      const targetUrl = `${protocol}://${host}${path}`;

      const fetchOptions: RequestInit = {
        method,
        headers: { ...headers },
      };

      if (payload && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
        if (!headers['content-type']) {
          (fetchOptions.headers as Record<string, string>)['content-type'] = 'application/json';
        }
      }

      const skipHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];
      for (const h of skipHeaders) {
        delete (fetchOptions.headers as Record<string, string>)[h];
      }

      const response = await fetch(targetUrl, fetchOptions);
      let responseBody: unknown;
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      return {
        success: true,
        replay: {
          method,
          url: targetUrl,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.warn('[Telescope] Replay error:', error);
      const message = error instanceof Error ? error.message : 'Replay failed';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('api/:type')
  async listEntries(
    @Param('type') typeParam: string,
    @Query('before') before?: string,
    @Query('take') take?: string,
    @Query('tag') tag?: string,
    @Query('familyHash') familyHash?: string,
  ): Promise<unknown> {
    try {
      const storage = this.telescope.getStorage();
      if (!storage) {
        throw new HttpException('Storage not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const entryType = ENTRY_TYPE_MAP[typeParam];
      if (!entryType) {
        throw new HttpException(`Unknown entry type: ${typeParam}`, HttpStatus.BAD_REQUEST);
      }

      const filter: EntryFilter = {
        type: entryType,
      };

      if (before) filter.beforeId = before;
      if (take) filter.take = Math.min(parseInt(take, 10) || 50, 100);
      else filter.take = 50;
      if (tag) filter.tag = tag;
      if (familyHash) filter.familyHash = familyHash;

      return await storage.query(filter);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.warn('[Telescope] Query error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('api/:type/:id')
  async getEntry(
    @Param('type') typeParam: string,
    @Param('id') id: string,
  ): Promise<{ entry: unknown; batch: unknown[] }> {
    try {
      const storage = this.telescope.getStorage();
      if (!storage) {
        throw new HttpException('Storage not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const entry = await storage.find(id);
      if (!entry) {
        throw new HttpException('Entry not found', HttpStatus.NOT_FOUND);
      }

      // Verify the entry type matches the URL segment
      const expectedType = ENTRY_TYPE_MAP[typeParam];
      if (expectedType && entry.type !== expectedType) {
        throw new HttpException('Entry not found', HttpStatus.NOT_FOUND);
      }

      // Fetch related batch entries
      let batch: unknown[] = [];
      try {
        const batchEntries = await storage.findByBatchId(entry.batchId);
        batch = batchEntries.filter((e: { id: string }) => e.id !== entry.id);
      } catch {
        // Batch fetch is non-critical
      }

      return { entry, batch };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.warn('[Telescope] Entry lookup error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
