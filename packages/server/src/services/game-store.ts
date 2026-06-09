import { Redis } from 'ioredis';
import type { AIPlayerConfig, GameState } from '@werewolf/shared';

export interface StoredGame {
  state: GameState;
  humanSeatIndex: number;
  aiConfigs: AIPlayerConfig[];
  createdAt: number;
}

export interface GameStore {
  saveGame(game: StoredGame): Promise<void>;
  loadGame(gameId: string): Promise<StoredGame | null>;
  deleteGame(gameId: string): Promise<void>;
  withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T>;
}

const LOCK_TTL_MS = 30_000;
const GAME_TTL_SECONDS = 86_400;

export class MemoryGameStore implements GameStore {
  private games = new Map<string, StoredGame>();
  private locks = new Map<string, Promise<unknown>>();

  async saveGame(game: StoredGame): Promise<void> {
    this.games.set(game.state.id, structuredClone(game));
  }

  async loadGame(gameId: string): Promise<StoredGame | null> {
    const game = this.games.get(gameId);
    return game ? structuredClone(game) : null;
  }

  async deleteGame(gameId: string): Promise<void> {
    this.games.delete(gameId);
  }

  async withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(gameId)) {
      await this.locks.get(gameId);
    }

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(gameId, gate);

    try {
      return await fn();
    } finally {
      this.locks.delete(gameId);
      release();
    }
  }
}

export class RedisGameStore implements GameStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  private gameKey(gameId: string) {
    return `game:${gameId}:state`;
  }

  private lockKey(gameId: string) {
    return `game:${gameId}:lock`;
  }

  async saveGame(game: StoredGame): Promise<void> {
    await this.redis.set(this.gameKey(game.state.id), JSON.stringify(game), 'EX', GAME_TTL_SECONDS);
  }

  async loadGame(gameId: string): Promise<StoredGame | null> {
    const raw = await this.redis.get(this.gameKey(gameId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredGame;
  }

  async deleteGame(gameId: string): Promise<void> {
    await this.redis.del(this.gameKey(gameId));
  }

  async withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
    const token = crypto.randomUUID();
    const acquired = await this.redis.set(this.lockKey(gameId), token, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') {
      throw new Error(`Could not acquire lock for game ${gameId}`);
    }

    try {
      return await fn();
    } finally {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(script, 1, this.lockKey(gameId), token);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

export function createGameStore(redisUrl?: string): GameStore {
  if (redisUrl && redisUrl.length > 0) {
    return new RedisGameStore(redisUrl);
  }
  return new MemoryGameStore();
}
