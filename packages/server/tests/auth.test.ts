import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { MemoryUserStore } from '../src/db/user-store.js';

describe('auth routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ userStore: new MemoryUserStore() });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/dev returns token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/dev',
      payload: { openid: 'test_openid' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string; userId: string };
    expect(body.token).toBeTruthy();
    expect(body.userId).toBeTruthy();
  });

  it('GET /api/auth/me requires token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/auth/me returns user with valid token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/dev',
      payload: {},
    });
    const { token } = login.json() as { token: string };

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('userId');
  });
});
