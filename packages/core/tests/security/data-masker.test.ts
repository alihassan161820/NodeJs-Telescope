import { describe, it, expect } from 'vitest';
import { DataMasker } from '../../src/security/data-masker.js';

describe('DataMasker', () => {
  it('masks default sensitive fields', () => {
    const masker = new DataMasker();
    const result = masker.mask({
      username: 'alice',
      password: 'secret123',
      token: 'jwt-abc',
      email: 'alice@test.com',
    });

    expect(result['username']).toBe('alice');
    expect(result['password']).toBe('********');
    expect(result['token']).toBe('********');
    expect(result['email']).toBe('alice@test.com');
  });

  it('masks nested objects', () => {
    const masker = new DataMasker();
    const result = masker.mask({
      user: {
        name: 'Bob',
        password: 'hunter2',
        profile: {
          credit_card: '4111-1111-1111-1111',
        },
      },
    });

    const user = result['user'] as Record<string, unknown>;
    expect(user['name']).toBe('Bob');
    expect(user['password']).toBe('********');

    const profile = user['profile'] as Record<string, unknown>;
    expect(profile['credit_card']).toBe('********');
  });

  it('accepts custom masked fields', () => {
    const masker = new DataMasker(['apiKey', 'ssn']);
    const result = masker.mask({
      apiKey: 'key-123',
      ssn: '123-45-6789',
      name: 'Test',
    });

    expect(result['apiKey']).toBe('********');
    expect(result['ssn']).toBe('********');
    expect(result['name']).toBe('Test');
  });

  it('case-insensitive matching', () => {
    const masker = new DataMasker();
    const result = masker.mask({
      PASSWORD: 'test',
      Token: 'abc',
      userPassword: 'hidden',
    });

    expect(result['PASSWORD']).toBe('********');
    expect(result['Token']).toBe('********');
    expect(result['userPassword']).toBe('********');
  });

  it('preserves non-sensitive fields', () => {
    const masker = new DataMasker();
    const result = masker.mask({
      id: 1,
      name: 'test',
      items: [1, 2, 3],
      active: true,
    });

    expect(result['id']).toBe(1);
    expect(result['name']).toBe('test');
    expect(result['items']).toEqual([1, 2, 3]);
    expect(result['active']).toBe(true);
  });
});
