import { createHash } from 'node:crypto';

export interface AudioCache {
  get(key: string): Buffer | undefined;
  set(key: string, data: Buffer): void;
  has(key: string): boolean;
}

export class MemoryAudioCache implements AudioCache {
  private store = new Map<string, Buffer>();

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, data: Buffer) {
    this.store.set(key, data);
  }

  has(key: string) {
    return this.store.has(key);
  }
}

export function ttsCacheKey(voiceId: string, text: string): string {
  return createHash('sha256').update(`${voiceId}:${text}`).digest('hex');
}

/** Minimal valid-ish MP3 placeholder for local dev when Aliyun is unavailable */
export function createSilentMp3Placeholder(): Buffer {
  return Buffer.from([
    0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}
