import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config.js';

export interface JwtPayload {
  sub: string;
  openid: string;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

function base64UrlDecodeToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function signToken(payload: JwtPayload, expiresInSeconds = 7 * 24 * 3600): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  );
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', env.jwtSecret).update(data).digest();
  return `${data}.${base64UrlEncode(signature)}`;
}

export function verifyToken(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const expected = createHmac('sha256', env.jwtSecret).update(data).digest();
  const actual = base64UrlDecodeToBuffer(sig);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecodeToString(body)) as JwtPayload & { exp?: number };
    if (!parsed.sub || !parsed.openid) return null;
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: parsed.sub, openid: parsed.openid };
  } catch {
    return null;
  }
}

export function extractBearerToken(authorization?: string): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}
