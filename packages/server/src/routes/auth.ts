import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signToken } from '../auth/jwt.js';
import { exchangeWeChatCode } from '../auth/wechat-client.js';
import type { UserStore } from '../db/user-store.js';
import { env } from '../config.js';

const WeChatLoginSchema = z.object({
  code: z.string().min(1),
});

const DevLoginSchema = z.object({
  openid: z.string().min(1).max(64).optional(),
});

export async function registerAuthRoutes(app: FastifyInstance, userStore: UserStore) {
  app.post('/api/auth/wechat', async (request, reply) => {
    const parsed = WeChatLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const session = await exchangeWeChatCode(parsed.data.code);
      const user = await userStore.findOrCreate(session.openid, session.unionid);
      const token = signToken({ sub: user.id, openid: user.openid });

      return {
        token,
        userId: user.id,
        expiresIn: 7 * 24 * 3600,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'WeChat login failed';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/api/auth/dev', async (request, reply) => {
    if (env.nodeEnv === 'production') {
      return reply.status(404).send({ error: 'Not found' });
    }

    const parsed = DevLoginSchema.safeParse(request.body ?? {});
    const openid = parsed.success ? (parsed.data.openid ?? `dev_${Date.now()}`) : `dev_${Date.now()}`;
    const user = await userStore.findOrCreate(openid);
    const token = signToken({ sub: user.id, openid: user.openid });

    return {
      token,
      userId: user.id,
      expiresIn: 7 * 24 * 3600,
      dev: true,
    };
  });

  app.get('/api/auth/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await userStore.findById(request.user.sub);
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      userId: user.id,
      openid: `${user.openid.slice(0, 4)}****`,
      createdAt: user.createdAt,
    };
  });
}
