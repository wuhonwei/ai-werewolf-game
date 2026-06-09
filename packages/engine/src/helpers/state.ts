import { Faction, Phase, Role, ROLE_FACTION, type GameState, type Seat } from '@werewolf/shared';

export function getSeat(state: GameState, index: number): Seat {
  const seat = state.seats[index];
  if (!seat) throw new Error(`Invalid seat index ${index}`);
  return seat;
}

export function isAlive(state: GameState, index: number): boolean {
  return getSeat(state, index).alive;
}

export function getAliveSeats(state: GameState): Seat[] {
  return state.seats.filter((s) => s.alive);
}

export function findSeatIndex(state: GameState, role: Role, aliveOnly = true): number | null {
  const seat = state.seats.find((s) => s.role === role && (!aliveOnly || s.alive));
  return seat?.index ?? null;
}

export function hasAliveRole(state: GameState, role: Role): boolean {
  return findSeatIndex(state, role) !== null;
}

export function hasAliveWolves(state: GameState): boolean {
  return state.seats.some((s) => s.alive && s.role === Role.WEREWOLF);
}

export function killSeat(state: GameState, index: number): GameState {
  return {
    ...state,
    seats: state.seats.map((s) => (s.index === index ? { ...s, alive: false } : s)),
  };
}

export function killSeats(state: GameState, indices: number[]): GameState {
  const dead = new Set(indices);
  return {
    ...state,
    seats: state.seats.map((s) => (dead.has(s.index) ? { ...s, alive: false } : s)),
  };
}

export function getAliveSpeakOrder(state: GameState): number[] {
  return state.speakOrder.filter((idx) => isAlive(state, idx));
}

export function isGodRole(role: Role): boolean {
  return role !== Role.VILLAGER && role !== Role.WEREWOLF;
}

export function countAliveByRole(state: GameState, role: Role): number {
  return state.seats.filter((s) => s.alive && s.role === role).length;
}

export function countAliveGods(state: GameState): number {
  return state.seats.filter((s) => s.alive && isGodRole(s.role)).length;
}

export function countAliveVillagers(state: GameState): number {
  return state.seats.filter((s) => s.alive && s.role === Role.VILLAGER).length;
}

export function countAliveWolves(state: GameState): number {
  return state.seats.filter((s) => s.alive && s.role === Role.WEREWOLF).length;
}

export function getFaction(role: Role): Faction {
  return ROLE_FACTION[role];
}

export function event(type: string, payload: Record<string, unknown> = {}) {
  return { type, payload, timestamp: Date.now() };
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

const NIGHT_PHASE_ORDER: Phase[] = [
  Phase.NIGHT_WOLF,
  Phase.NIGHT_SEER,
  Phase.NIGHT_WITCH,
  Phase.NIGHT_GUARD,
  Phase.NIGHT_RESOLVE,
];

function isNightPhaseActive(state: GameState, phase: Phase): boolean {
  switch (phase) {
    case Phase.NIGHT_WOLF:
      return hasAliveWolves(state);
    case Phase.NIGHT_SEER:
      return hasAliveRole(state, Role.SEER);
    case Phase.NIGHT_WITCH:
      return hasAliveRole(state, Role.WITCH);
    case Phase.NIGHT_GUARD:
      return hasAliveRole(state, Role.GUARD);
    case Phase.NIGHT_RESOLVE:
      return true;
    default:
      return false;
  }
}

export function getNextNightPhase(state: GameState, current: Phase): Phase {
  const idx = NIGHT_PHASE_ORDER.indexOf(current);
  for (let i = idx + 1; i < NIGHT_PHASE_ORDER.length; i += 1) {
    const phase = NIGHT_PHASE_ORDER[i];
    if (isNightPhaseActive(state, phase)) return phase;
  }
  return Phase.NIGHT_RESOLVE;
}

export function resetNightFields(state: GameState): GameState {
  return {
    ...state,
    night: {
      wolfTarget: null,
      seerTarget: null,
      witchUseHeal: null,
      witchPoisonTarget: null,
      guardTarget: null,
      lastGuardTarget: state.night.lastGuardTarget,
    },
    witchHealDecided: false,
    witchPoisonDecided: false,
  };
}
