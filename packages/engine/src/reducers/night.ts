import { Phase, Role, type GameState } from '@werewolf/shared';
import type { GameEvent } from '@werewolf/shared';
import {
  cloneState,
  event,
  findSeatIndex,
  getFaction,
  getNextNightPhase,
  getSeat,
  isAlive,
} from '../helpers/state.js';
import { resolveNight } from '../check-win.js';

function assertSeat(state: GameState, seatIndex: number, role: Role): string | null {
  const seat = state.seats[seatIndex];
  if (!seat) return `Invalid seat index ${seatIndex}`;
  if (!seat.alive) return `Seat ${seatIndex} is dead`;
  if (seat.role !== role) return `Seat ${seatIndex} is not ${role}`;
  return null;
}

function assertPhase(state: GameState, phase: Phase): string | null {
  if (state.phase !== phase) return `Expected phase ${phase}, got ${state.phase}`;
  return null;
}

function advancePhase(state: GameState, nextPhase: Phase, events: GameEvent[]): GameState {
  events.push(event('PHASE_CHANGE', { phase: nextPhase, day: state.day }));
  return { ...state, phase: nextPhase };
}

export function handleWolfKill(
  state: GameState,
  seatIndex: number,
  target: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const err =
    assertPhase(state, Phase.NIGHT_WOLF) ??
    assertSeat(state, seatIndex, Role.WEREWOLF);
  if (err) return { ok: false, error: err };
  if (!isAlive(state, target)) return { ok: false, error: 'Target is dead' };
  if (target === seatIndex) return { ok: false, error: 'Wolves cannot kill themselves' };

  const events: GameEvent[] = [event('WOLF_KILL', { target })];
  const next = advancePhase(
    {
      ...state,
      night: { ...state.night, wolfTarget: target },
    },
    getNextNightPhase(state, Phase.NIGHT_WOLF),
    events,
  );
  return { ok: true, state: next, events };
}

export function handleSeerCheck(
  state: GameState,
  seatIndex: number,
  target: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const err =
    assertPhase(state, Phase.NIGHT_SEER) ??
    assertSeat(state, seatIndex, Role.SEER);
  if (err) return { ok: false, error: err };
  if (!isAlive(state, target)) return { ok: false, error: 'Target is dead' };
  if (target === seatIndex) return { ok: false, error: 'Seer cannot check themselves' };

  const targetRole = getSeat(state, target).role;
  const result = getFaction(targetRole);
  const events: GameEvent[] = [event('SEER_CHECK', { target, result })];
  let next: GameState = {
    ...state,
    night: { ...state.night, seerTarget: target },
    seerChecks: [...state.seerChecks, { day: state.day, target, result }],
  };
  next = advancePhase(next, getNextNightPhase(next, Phase.NIGHT_SEER), events);
  return { ok: true, state: next, events };
}

export function handleWitchHeal(
  state: GameState,
  seatIndex: number,
  useHeal: boolean,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const err =
    assertPhase(state, Phase.NIGHT_WITCH) ??
    assertSeat(state, seatIndex, Role.WITCH);
  if (err) return { ok: false, error: err };
  if (state.witchHealDecided) return { ok: false, error: 'Witch heal already decided' };

  if (useHeal && !state.witch.healAvailable) {
    return { ok: false, error: 'Heal potion not available' };
  }

  const wolfTarget = state.night.wolfTarget;
  if (
    useHeal &&
    wolfTarget === seatIndex &&
    state.day === 1 &&
    !state.rules.witchSelfSaveFirstNight
  ) {
    return { ok: false, error: 'Witch cannot self-save on first night' };
  }

  const events: GameEvent[] = [event('WITCH_HEAL', { useHeal })];
  let next: GameState = {
    ...state,
    witchHealDecided: true,
    night: { ...state.night, witchUseHeal: useHeal },
  };

  if (!state.witch.poisonAvailable) {
    next = { ...next, witchPoisonDecided: true };
  }

  if (next.witchPoisonDecided) {
    const advanced = advancePhase(next, getNextNightPhase(next, Phase.NIGHT_WITCH), events);
    return { ok: true, state: advanced, events };
  }

  return { ok: true, state: next, events };
}

export function handleWitchPoison(
  state: GameState,
  seatIndex: number,
  target: number | null,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const err =
    assertPhase(state, Phase.NIGHT_WITCH) ??
    assertSeat(state, seatIndex, Role.WITCH);
  if (err) return { ok: false, error: err };
  if (!state.witchHealDecided) return { ok: false, error: 'Witch must decide heal first' };
  if (state.witchPoisonDecided) return { ok: false, error: 'Witch poison already decided' };

  if (target !== null) {
    if (!state.witch.poisonAvailable) return { ok: false, error: 'Poison not available' };
    if (!isAlive(state, target)) return { ok: false, error: 'Target is dead' };
    if (target === seatIndex) return { ok: false, error: 'Witch cannot poison themselves' };
  }

  const events: GameEvent[] = [event('WITCH_POISON', { target })];
  let next: GameState = {
    ...state,
    witchPoisonDecided: true,
    night: { ...state.night, witchPoisonTarget: target },
  };
  next = advancePhase(next, getNextNightPhase(next, Phase.NIGHT_WITCH), events);
  return { ok: true, state: next, events };
}

export function handleGuardProtect(
  state: GameState,
  seatIndex: number,
  target: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const err =
    assertPhase(state, Phase.NIGHT_GUARD) ??
    assertSeat(state, seatIndex, Role.GUARD);
  if (err) return { ok: false, error: err };
  if (!isAlive(state, target)) return { ok: false, error: 'Target is dead' };
  if (
    state.rules.guardNoConsecutiveGuard &&
    state.night.lastGuardTarget !== null &&
    target === state.night.lastGuardTarget
  ) {
    return { ok: false, error: 'Guard cannot protect the same player two nights in a row' };
  }

  const events: GameEvent[] = [event('GUARD_PROTECT', { target })];
  let next: GameState = {
    ...state,
    night: { ...state.night, guardTarget: target },
  };
  next = advancePhase(next, Phase.NIGHT_RESOLVE, events);
  return { ok: true, state: next, events };
}

export function handleNightResolve(state: GameState): { state: GameState; events: GameEvent[] } {
  const { state: resolved, events } = resolveNight(state);
  return { state: resolved, events };
}

export function handleSkipNightAction(
  state: GameState,
  seatIndex: number,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string } {
  const seat = getSeat(state, seatIndex);
  if (!seat.alive) return { ok: false, error: 'Seat is dead' };

  const events: GameEvent[] = [event('SKIP_NIGHT_ACTION', { seatIndex })];

  switch (state.phase) {
    case Phase.NIGHT_WOLF: {
      if (seat.role !== Role.WEREWOLF) return { ok: false, error: 'Not wolf phase for this seat' };
      const next = advancePhase(
        { ...state, night: { ...state.night, wolfTarget: null } },
        getNextNightPhase(state, Phase.NIGHT_WOLF),
        events,
      );
      return { ok: true, state: next, events };
    }
    case Phase.NIGHT_SEER: {
      if (seat.role !== Role.SEER) return { ok: false, error: 'Not seer phase for this seat' };
      const next = advancePhase(state, getNextNightPhase(state, Phase.NIGHT_SEER), events);
      return { ok: true, state: next, events };
    }
    case Phase.NIGHT_WITCH: {
      if (seat.role !== Role.WITCH) return { ok: false, error: 'Not witch phase for this seat' };
      if (!state.witchHealDecided) {
        return handleWitchHeal(state, seatIndex, false);
      }
      return handleWitchPoison(state, seatIndex, null);
    }
    case Phase.NIGHT_GUARD: {
      if (seat.role !== Role.GUARD) return { ok: false, error: 'Not guard phase for this seat' };
      const next = advancePhase(state, Phase.NIGHT_RESOLVE, events);
      return { ok: true, state: next, events };
    }
    default:
      return { ok: false, error: 'Cannot skip in current phase' };
  }
}

export function autoAdvanceDeadRolePhases(state: GameState): GameState {
  let current = cloneState(state);
  const maxSteps = 6;
  for (let i = 0; i < maxSteps; i += 1) {
    if (current.phase === Phase.NIGHT_WOLF && findSeatIndex(current, Role.WEREWOLF) === null) {
      current = { ...current, phase: getNextNightPhase(current, Phase.NIGHT_WOLF) };
      continue;
    }
    if (current.phase === Phase.NIGHT_SEER && findSeatIndex(current, Role.SEER) === null) {
      current = { ...current, phase: getNextNightPhase(current, Phase.NIGHT_SEER) };
      continue;
    }
    if (current.phase === Phase.NIGHT_WITCH && findSeatIndex(current, Role.WITCH) === null) {
      current = { ...current, phase: getNextNightPhase(current, Phase.NIGHT_WITCH) };
      continue;
    }
    if (current.phase === Phase.NIGHT_GUARD && findSeatIndex(current, Role.GUARD) === null) {
      current = { ...current, phase: Phase.NIGHT_RESOLVE };
      continue;
    }
    break;
  }
  return current;
}
