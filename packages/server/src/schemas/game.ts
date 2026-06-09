import { z } from 'zod';
import { Role } from '@werewolf/shared';

export const VoiceConfigSchema = z.object({
  provider: z.literal('aliyun'),
  voiceId: z.string().min(1),
  speed: z.number().min(0.5).max(2),
  pitch: z.number().min(0.5).max(2),
});

export const AIPlayerConfigSchema = z.object({
  seatIndex: z.number().min(0).max(11),
  model: z.literal('deepseek-chat'),
  temperature: z.number().min(0).max(2),
  personality: z.string().min(1).max(200),
  voice: VoiceConfigSchema,
});

export const CreateGameSchema = z.object({
  humanSeatIndex: z.number().min(0).max(11),
  humanRole: z.nativeEnum(Role).nullable(),
  aiConfigs: z.array(AIPlayerConfigSchema).length(11),
  seed: z.number().int().optional(),
});

export type CreateGameInput = z.infer<typeof CreateGameSchema>;

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START_GAME') }),
  z.object({ type: z.literal('SPEAK'), seatIndex: z.number(), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal('END_SPEECH'), seatIndex: z.number() }),
  z.object({ type: z.literal('WOLF_KILL'), seatIndex: z.number(), target: z.number() }),
  z.object({ type: z.literal('SEER_CHECK'), seatIndex: z.number(), target: z.number() }),
  z.object({ type: z.literal('WITCH_HEAL'), seatIndex: z.number(), useHeal: z.boolean() }),
  z.object({ type: z.literal('WITCH_POISON'), seatIndex: z.number(), target: z.number().nullable() }),
  z.object({ type: z.literal('GUARD_PROTECT'), seatIndex: z.number(), target: z.number() }),
  z.object({ type: z.literal('VOTE'), seatIndex: z.number(), target: z.number().nullable() }),
  z.object({ type: z.literal('HUNTER_SHOOT'), seatIndex: z.number(), target: z.number() }),
  z.object({ type: z.literal('SKIP_NIGHT_ACTION'), seatIndex: z.number() }),
  z.object({ type: z.literal('END_DAY_ANNOUNCE') }),
]);

export const SubmitActionSchema = z.object({
  action: GameActionSchema,
});

export const WsJoinSchema = z.object({
  type: z.literal('JOIN'),
  humanSeatIndex: z.number().min(0).max(11),
});

export const WsActionSchema = z.object({
  type: z.literal('ACTION'),
  action: GameActionSchema,
});

export const WsPingSchema = z.object({
  type: z.literal('PING'),
});

export const WsClientMessageSchema = z.discriminatedUnion('type', [
  WsJoinSchema,
  WsActionSchema,
  WsPingSchema,
]);
