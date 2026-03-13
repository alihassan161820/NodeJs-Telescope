// → EntryType.php
// Enum of all telescope entry types, mirroring Laravel Telescope's EntryType

export enum EntryType {
  Request = 'request',
  Exception = 'exception',
  Log = 'log',
  Query = 'query',
  Model = 'model',
  Event = 'event',
  Job = 'job',
  Mail = 'mail',
  Notification = 'notification',
  Cache = 'cache',
  Redis = 'redis',
  Gate = 'gate',
  HttpClient = 'http_client',
  Command = 'command',
  Schedule = 'schedule',
  Dump = 'dump',
  Batch = 'batch',
  View = 'view',
}
