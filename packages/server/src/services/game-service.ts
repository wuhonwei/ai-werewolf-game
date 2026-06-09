import { applyAction, createGame, getPublicState, getRoleForSeat } from '@werewolf/engine';
import {
  STANDARD_12_YWLG,
  type GameAction,
  type GameEvent,
  type PlayerHints,
  type PublicGameState,
  type Role,
} from '@werewolf/shared';
import type { CreateGameInput } from '../schemas/game.js';
import { logAIJobs, planNextStep, type AIJobStub } from './phase-scheduler.js';
import { buildPlayerHints } from './player-hints.js';
import type { GameStore, StoredGame } from './game-store.js';
import type { AIPlayerService } from '../ai/ai-player-service.js';

export interface CreateGameResult {
  gameId: string;
  publicState: PublicGameState;
  humanRole: Role;
}

export interface PlayerView {
  publicState: PublicGameState;
  humanRole: Role;
  discussion: StoredGame['state']['discussion'];
  lastNightDeaths: number[];
  hints: PlayerHints;
}

export interface ActionResultView {
  ok: true;
  publicState: PublicGameState;
  humanRole: Role;
  discussion: StoredGame['state']['discussion'];
  lastNightDeaths: number[];
  hints: PlayerHints;
  events: GameEvent[];
  aiJobsQueued: number;
}

export interface PendingPlan {
  autoActions: GameAction[];
  aiJobs: AIJobStub[];
}

export class GameService {
  constructor(
    private readonly store: GameStore,
    private readonly logger: { info: (obj: unknown, msg?: string) => void } = console,
  ) {}

  async createGame(input: CreateGameInput): Promise<CreateGameResult> {
    const aiSeats = new Set(input.aiConfigs.map((c) => c.seatIndex));
    if (aiSeats.size !== 11) {
      throw new Error('aiConfigs must have 11 unique seat indices');
    }
    for (const cfg of input.aiConfigs) {
      if (cfg.seatIndex === input.humanSeatIndex) {
        throw new Error('aiConfigs cannot include human seat');
      }
    }

    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: input.humanSeatIndex,
      humanRole: input.humanRole,
      aiSeatIndices: input.aiConfigs.map((c) => c.seatIndex),
      seed: input.seed,
    });

    const stored: StoredGame = {
      state,
      humanSeatIndex: input.humanSeatIndex,
      aiConfigs: input.aiConfigs,
      createdAt: Date.now(),
    };

    await this.store.saveGame(stored);

    return {
      gameId: state.id,
      publicState: getPublicState(state),
      humanRole: getRoleForSeat(state, input.humanSeatIndex, input.humanSeatIndex)!,
    };
  }

  async getVoiceConfigForSeat(
    gameId: string,
    seatIndex: number,
  ): Promise<{ voiceId: string; speed: number }> {
    const stored = await this.store.loadGame(gameId);
    if (!stored) {
      return { voiceId: 'xiaoyun', speed: 1.0 };
    }

    if (seatIndex === stored.humanSeatIndex) {
      return { voiceId: 'xiaoyun', speed: 1.0 };
    }

    const cfg = stored.aiConfigs.find((c) => c.seatIndex === seatIndex);
    return cfg
      ? { voiceId: cfg.voice.voiceId, speed: cfg.voice.speed }
      : { voiceId: 'xiaoyun', speed: 1.0 };
  }

  async getPlayerView(gameId: string, humanSeatIndex: number): Promise<PlayerView | null> {
    const stored = await this.store.loadGame(gameId);
    if (!stored) return null;
    if (stored.humanSeatIndex !== humanSeatIndex) return null;

    return this.toPlayerView(stored, humanSeatIndex);
  }

  async getPendingPlan(gameId: string, humanSeatIndex: number): Promise<PendingPlan | null> {
    const stored = await this.store.loadGame(gameId);
    if (!stored) return null;
    return planNextStep(gameId, stored.state, humanSeatIndex);
  }

  async applyHumanAction(
    gameId: string,
    humanSeatIndex: number,
    action: GameAction,
  ): Promise<ActionResultView | { ok: false; error: string }> {
    return this.store.withGameLock(gameId, async () => {
      const stored = await this.store.loadGame(gameId);
      if (!stored) return { ok: false, error: 'Game not found' };
      if (stored.humanSeatIndex !== humanSeatIndex) {
        return { ok: false, error: 'Invalid human seat' };
      }

      const validationError = this.validateHumanAction(stored, action);
      if (validationError) return { ok: false, error: validationError };

      return this.processActions(stored, [action], humanSeatIndex);
    });
  }

  async applyAutoActions(
    gameId: string,
    humanSeatIndex: number,
  ): Promise<ActionResultView | null> {
    return this.store.withGameLock(gameId, async () => {
      const stored = await this.store.loadGame(gameId);
      if (!stored) return null;

      const plan = planNextStep(gameId, stored.state, humanSeatIndex);
      if (plan.autoActions.length === 0) return null;

      const result = await this.processActions(stored, plan.autoActions, humanSeatIndex);
      return result.ok ? result : null;
    });
  }

  async applyAIJob(
    gameId: string,
    humanSeatIndex: number,
    seatIndex: number,
    aiPlayer: AIPlayerService,
  ): Promise<ActionResultView | null> {
    return this.store.withGameLock(gameId, async () => {
      const stored = await this.store.loadGame(gameId);
      if (!stored) return null;

      const actions = await aiPlayer.decideActions(stored, seatIndex);
      const result = await this.processActions(stored, actions, humanSeatIndex);
      return result.ok ? result : null;
    });
  }

  private async processActions(
    stored: StoredGame,
    actions: GameAction[],
    humanSeatIndex: number,
  ): Promise<ActionResultView | { ok: false; error: string }> {
    let state = stored.state;
    let allEvents: GameEvent[] = [];

    for (const action of actions) {
      const result = applyAction(state, action);
      if (!result.ok) return result;
      state = result.state;
      allEvents.push(...result.events);
    }

    const auto = await this.runAutoSteps(stored.state.id, stored, state, allEvents);
    state = auto.state;
    allEvents = auto.events;

    stored.state = state;
    await this.store.saveGame(stored);

    const finalPlan = planNextStep(stored.state.id, state, humanSeatIndex);
    logAIJobs(finalPlan.aiJobs, this.logger);

    return {
      ok: true,
      ...this.toPlayerView(stored, humanSeatIndex),
      events: allEvents,
      aiJobsQueued: finalPlan.aiJobs.length,
    };
  }

  private toPlayerView(stored: StoredGame, humanSeatIndex: number): Omit<ActionResultView, 'ok' | 'events' | 'aiJobsQueued'> {
    return {
      publicState: getPublicState(stored.state),
      humanRole: getRoleForSeat(stored.state, humanSeatIndex, humanSeatIndex)!,
      discussion: stored.state.discussion,
      lastNightDeaths: stored.state.lastNightDeaths,
      hints: buildPlayerHints(stored.state, humanSeatIndex),
    };
  }

  private validateHumanAction(stored: StoredGame, action: GameAction): string | null {
    if (action.type === 'START_GAME') return null;
    if (action.type === 'END_DAY_ANNOUNCE') return null;

    if ('seatIndex' in action && action.seatIndex !== stored.humanSeatIndex) {
      return 'Can only submit actions for your own seat';
    }

    const humanSeat = stored.state.seats[stored.humanSeatIndex];
    if (!humanSeat?.alive && action.type !== 'HUNTER_SHOOT') {
      return 'You are eliminated';
    }

    return null;
  }

  private async runAutoSteps(
    gameId: string,
    stored: StoredGame,
    state: StoredGame['state'],
    events: GameEvent[],
  ): Promise<{ state: StoredGame['state']; events: GameEvent[] }> {
    let current = state;
    let maxSteps = 20;

    while (maxSteps-- > 0) {
      const plan = planNextStep(gameId, current, stored.humanSeatIndex);
      if (plan.autoActions.length === 0) break;

      for (const autoAction of plan.autoActions) {
        const result = applyAction(current, autoAction);
        if (!result.ok) break;
        current = result.state;
        events.push(...result.events);
      }
    }

    return { state: current, events };
  }
}
