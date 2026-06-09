import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { CreateGameSchema, SubmitActionSchema } from '../schemas/game.js';
import type { GameService } from '../services/game-service.js';
import type { AIOrchestrator } from '../workers/ai-orchestrator.js';

export async function registerGameRoutes(
  app: FastifyInstance,
  gameService: GameService,
  aiOrchestrator: AIOrchestrator,
  requireAuth: preHandlerHookHandler,
) {
  app.post('/api/games', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CreateGameSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await gameService.createGame(parsed.data);
      return reply.status(201).send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create game';
      return reply.status(400).send({ error: message });
    }
  });

  app.get('/api/games/:gameId', { preHandler: requireAuth }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const humanSeatIndex = Number((request.query as { humanSeatIndex?: string }).humanSeatIndex);

    if (Number.isNaN(humanSeatIndex)) {
      return reply.status(400).send({ error: 'humanSeatIndex query param required' });
    }

    const view = await gameService.getPlayerView(gameId, humanSeatIndex);
    if (!view) {
      return reply.status(404).send({ error: 'Game not found' });
    }

    return view;
  });

  app.post('/api/games/:gameId/actions', { preHandler: requireAuth }, async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const humanSeatIndex = Number((request.query as { humanSeatIndex?: string }).humanSeatIndex);

    if (Number.isNaN(humanSeatIndex)) {
      return reply.status(400).send({ error: 'humanSeatIndex query param required' });
    }

    const parsed = SubmitActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const result = await gameService.applyHumanAction(gameId, humanSeatIndex, parsed.data.action);
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    if (result.aiJobsQueued > 0) {
      aiOrchestrator.enqueue(gameId, humanSeatIndex);
    }

    return result;
  });
}
