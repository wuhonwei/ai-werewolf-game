import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, extractBearerToken } from '../src/auth/jwt.js';

describe('jwt', () => {
  it('signs and verifies token', () => {
    const token = signToken({ sub: 'user-1', openid: 'wx_openid' });
    const payload = verifyToken(token);
    expect(payload).toEqual({ sub: 'user-1', openid: 'wx_openid' });
  });

  it('rejects tampered token', () => {
    const token = signToken({ sub: 'user-1', openid: 'wx_openid' });
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('extracts bearer token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('Basic x')).toBeNull();
  });
});
