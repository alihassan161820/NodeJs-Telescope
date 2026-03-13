import { describe, it, expect } from 'vitest';
import { HeaderFilter } from '../../src/security/header-filter.js';

describe('HeaderFilter', () => {
  it('masks default sensitive headers', () => {
    const filter = new HeaderFilter();
    const result = filter.filter({
      'content-type': 'application/json',
      authorization: 'Bearer xyz',
      cookie: 'session=abc',
      'x-custom': 'value',
    });

    expect(result['content-type']).toBe('application/json');
    expect(result['authorization']).toBe('********');
    expect(result['cookie']).toBe('********');
    expect(result['x-custom']).toBe('value');
  });

  it('case-insensitive header matching', () => {
    const filter = new HeaderFilter();
    const result = filter.filter({
      Authorization: 'Bearer token',
      COOKIE: 'session=123',
    });

    expect(result['Authorization']).toBe('********');
    expect(result['COOKIE']).toBe('********');
  });

  it('accepts custom hidden headers', () => {
    const filter = new HeaderFilter(['x-api-key', 'x-secret']);
    const result = filter.filter({
      'x-api-key': 'key123',
      'x-secret': 'shhh',
      'content-type': 'text/html',
    });

    expect(result['x-api-key']).toBe('********');
    expect(result['x-secret']).toBe('********');
    expect(result['content-type']).toBe('text/html');
  });
});
