import { randomUUID } from 'node:crypto';
import type { Role } from '@werewolf/shared';

/** Mulberry32 seeded PRNG for reproducible shuffles in tests */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignRoles(
  roles: Role[],
  humanSeatIndex: number,
  humanRole: Role | null,
  seed: number,
): Role[] {
  const seatCount = roles.length;
  const assignments: Role[] = new Array(seatCount);

  if (humanRole !== null) {
    const remaining = roles.filter((r) => r !== humanRole);
    const shuffled = shuffle(remaining, createRng(seed));
    let idx = 0;
    for (let seat = 0; seat < seatCount; seat += 1) {
      if (seat === humanSeatIndex) {
        assignments[seat] = humanRole;
      } else {
        assignments[seat] = shuffled[idx];
        idx += 1;
      }
    }
    return assignments;
  }

  const shuffled = shuffle(roles, createRng(seed));
  return shuffled;
}

export function generateGameId(): string {
  return randomUUID();
}
