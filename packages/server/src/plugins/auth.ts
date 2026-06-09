import type { FastifyReply, FastifyRequest } from 'fastify';
import { extractBearerToken, verifyToken, type JwtPayload } from '../auth/jwt.js';
import { env } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function optionalAuthHook(request: FastifyRequest, _reply: FastifyReply) {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;
  const payload = verifyToken(token);
  if (payload) request.user = payload;
}

export async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
  if (!env.authRequired) return;

  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    return reply.status(401).send({ error: 'Authorization required' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  request.user = payload;
}
