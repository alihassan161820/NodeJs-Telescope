// → ExtractTags.php
// Auto-tagging logic — extracts tags from entry content based on type

import { EntryType } from './entry-type.js';
import type { IncomingEntry } from './incoming-entry.js';

/** Extract auto-tags from an entry based on its type and content */
export function extractTags(entry: IncomingEntry): string[] {
  const tags: string[] = [];
  const content = entry.content;

  switch (entry.type) {
    case EntryType.Request:
      if (typeof content['method'] === 'string') {
        tags.push(content['method'] as string);
      }
      if (typeof content['responseStatus'] === 'number') {
        const status = content['responseStatus'] as number;
        tags.push(`status:${status}`);
        if (status >= 400) tags.push('error');
        if (status >= 500) tags.push('server-error');
      }
      if (typeof content['path'] === 'string') {
        tags.push(`uri:${content['path'] as string}`);
      }
      break;

    case EntryType.Exception:
      if (typeof content['class'] === 'string') {
        tags.push(content['class'] as string);
      }
      break;

    case EntryType.Log:
      if (typeof content['level'] === 'string') {
        tags.push(content['level'] as string);
      }
      break;

    case EntryType.Query:
      if (typeof content['connection'] === 'string') {
        tags.push(content['connection'] as string);
      }
      if (content['slow'] === true) {
        tags.push('slow');
      }
      break;

    case EntryType.Job:
      if (typeof content['name'] === 'string') {
        tags.push(content['name'] as string);
      }
      if (typeof content['status'] === 'string') {
        tags.push(content['status'] as string);
      }
      break;

    case EntryType.Mail:
      if (typeof content['to'] === 'string') {
        tags.push(`to:${content['to'] as string}`);
      }
      break;

    case EntryType.Cache:
      if (typeof content['type'] === 'string') {
        tags.push(content['type'] as string);
      }
      break;

    case EntryType.HttpClient:
      if (typeof content['method'] === 'string') {
        tags.push(content['method'] as string);
      }
      if (typeof content['url'] === 'string') {
        try {
          const url = new URL(content['url'] as string);
          tags.push(`host:${url.hostname}`);
        } catch {
          // Invalid URL — skip tag
        }
      }
      break;

    case EntryType.Model:
      if (typeof content['model'] === 'string') {
        tags.push(content['model'] as string);
      }
      if (typeof content['action'] === 'string') {
        tags.push(content['action'] as string);
      }
      break;

    case EntryType.Event:
      if (typeof content['name'] === 'string') {
        tags.push(content['name'] as string);
      }
      break;

    case EntryType.Notification:
      if (typeof content['channel'] === 'string') {
        tags.push(`channel:${content['channel'] as string}`);
      }
      if (typeof content['notification'] === 'string') {
        tags.push(content['notification'] as string);
      }
      break;

    case EntryType.Redis:
      if (typeof content['command'] === 'string') {
        tags.push(content['command'] as string);
      }
      if (typeof content['connection'] === 'string') {
        tags.push(`connection:${content['connection'] as string}`);
      }
      break;

    case EntryType.Gate:
      if (typeof content['ability'] === 'string') {
        tags.push(content['ability'] as string);
      }
      if (typeof content['result'] === 'string') {
        tags.push(content['result'] as string);
      }
      break;

    case EntryType.Command:
      if (typeof content['command'] === 'string') {
        tags.push(content['command'] as string);
      }
      if (typeof content['exitCode'] === 'number' && content['exitCode'] !== 0) {
        tags.push('failed');
      }
      break;

    case EntryType.Schedule:
      if (typeof content['name'] === 'string') {
        tags.push(content['name'] as string);
      }
      break;

    case EntryType.Dump:
      if (typeof content['file'] === 'string') {
        tags.push(`file:${content['file'] as string}`);
      }
      break;

    case EntryType.Batch:
      if (typeof content['name'] === 'string') {
        tags.push(content['name'] as string);
      }
      if (typeof content['failedJobs'] === 'number' && (content['failedJobs'] as number) > 0) {
        tags.push('has-failures');
      }
      break;

    case EntryType.View:
      if (typeof content['name'] === 'string') {
        tags.push(content['name'] as string);
      }
      break;

    default:
      break;
  }

  return tags;
}
