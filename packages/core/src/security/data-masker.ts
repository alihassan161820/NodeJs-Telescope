// PII masking pipeline — intercepts data before storage
// Mirrors Laravel Telescope's HideRequestParameters / censorRequestParameters

const DEFAULT_MASKED_FIELDS = ['password', 'token', 'secret', 'credit_card', 'creditCard', 'ssn'];
const MASK_VALUE = '********';

export class DataMasker {
  private maskedFields: string[];

  constructor(maskedFields?: string[]) {
    this.maskedFields = maskedFields ?? DEFAULT_MASKED_FIELDS;
  }

  /** Mask sensitive fields in a content object */
  mask(content: Record<string, unknown>): Record<string, unknown> {
    return this.deepMask({ ...content });
  }

  private deepMask(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldMask(key)) {
        result[key] = MASK_VALUE;
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.deepMask(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private shouldMask(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.maskedFields.some((field) => lowerKey.includes(field.toLowerCase()));
  }
}
