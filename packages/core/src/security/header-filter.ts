// Sensitive header stripping — removes auth/cookie headers before storage
// Mirrors Laravel Telescope's HideRequestHeaders config

const DEFAULT_HIDDEN_HEADERS = ['authorization', 'cookie', 'set-cookie'];
const MASK_VALUE = '********';

export class HeaderFilter {
  private hiddenHeaders: string[];

  constructor(hiddenHeaders?: string[]) {
    this.hiddenHeaders = (hiddenHeaders ?? DEFAULT_HIDDEN_HEADERS).map((h) => h.toLowerCase());
  }

  /** Filter headers, masking sensitive ones */
  filter(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
    const filtered: Record<string, string | string[] | undefined> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.hiddenHeaders.includes(key.toLowerCase())) {
        filtered[key] = MASK_VALUE;
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
