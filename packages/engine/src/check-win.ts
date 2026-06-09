import { Faction, GameStatus, Phase, Role, type GameState } from '@werewolf/shared';
import {
  countAliveGods,
  countAliveVillagers,
  countAliveWolves,
  event,
  getSeat,
  isAlive,
  killSeats,
} from './helpers/state.js';

export function resolveNight(state: GameState): {
  state: GameState;
  deaths: number[];
  events: ReturnType<typeof event>[];
} {
  const deaths = new Set<number>();
  const events: ReturnType<typeof event>[] = [];
  const { wolfTarget, guardTarget, witchUseHeal, witchPoisonTarget } = state.night;

  if (witchPoisonTarget !== null && isAlive(state, witchPoisonTarget)) {
    deaths.add(witchPoisonTarget);
    events.push(event('PLAYER_DIED', { seatIndex: witchPoisonTarget, cause: 'poison' }));
  }

  if (wolfTarget !== null && isAlive(state, wolfTarget)) {
    let killedByWolf = true;
    if (guardTarget === wolfTarget) killedByWolf = false;
    if (witchUseHeal === true) killedByWolf = false;

    if (killedByWolf) {
      deaths.add(wolfTarget);
      events.push(event('PLAYER_DIED', { seatIndex: wolfTarget, cause: 'wolf' }));
    }
  }

  let next = killSeats(state, [...deaths]);
  const deathList = [...deaths];

  for (const idx of deathList) {
    if (getSeat(next, idx).role === Role.HUNTER) {
      next = { ...next, pendingHunterSeat: idx, pendingHunterReason: 'night' };
      events.push(event('HUNTER_CAN_SHOOT', { seatIndex: idx }));
      break;
    }
  }

  let witch = { ...next.witch };
  if (witchUseHeal === true) witch = { ...witch, healAvailable: false };
  if (witchPoisonTarget !== null) witch = { ...witch, poisonAvailable: false };

  next = {
    ...next,
    witch,
    lastNightDeaths: deathList,
    night: {
      ...next.night,
      lastGuardTarget: guardTarget ?? next.night.lastGuardTarget,
    },
  };

  events.push(event('NIGHT_RESOLVED', { deaths: deathList }));

  if (next.pendingHunterSeat !== null) {
    next = { ...next, phase: Phase.HUNTER_SHOOT };
  } else if (deathList.length > 0) {
    next = { ...next, phase: Phase.DAY_ANNOUNCE };
  } else {
    next = { ...next, phase: Phase.DAY_DISCUSS, currentSpeakerIndex: 0 };
  }

  return { state: next, deaths: deathList, events };
}

export function advanceFromDayAnnounce(state: GameState): GameState {
  return {
    ...state,
    phase: Phase.DAY_DISCUSS,
    currentSpeakerIndex: 0,
  };
}

export function beginNextNight(state: GameState): GameState {
  return {
    ...state,
    day: state.day + 1,
    phase: Phase.NIGHT_WOLF,
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
    lastNightDeaths: [],
    currentVotes: null,
  };
}

export function runCheckWinPhase(state: GameState): {
  state: GameState;
  events: ReturnType<typeof event>[];
} {
  const wolves = countAliveWolves(state);
  const gods = countAliveGods(state);
  const villagers = countAliveVillagers(state);
  const events: ReturnType<typeof event>[] = [];

  if (wolves === 0) {
    const finished = {
      ...state,
      phase: Phase.GAME_OVER,
      status: GameStatus.FINISHED,
      winner: Faction.VILLAGER,
    };
    events.push(event('GAME_OVER', { winner: Faction.VILLAGER }));
    return { state: finished, events };
  }

  if (gods === 0 || villagers === 0) {
    const finished = {
      ...state,
      phase: Phase.GAME_OVER,
      status: GameStatus.FINISHED,
      winner: Faction.WEREWOLF,
    };
    events.push(event('GAME_OVER', { winner: Faction.WEREWOLF }));
    return { state: finished, events };
  }

  const next = beginNextNight(state);
  events.push(event('PHASE_CHANGE', { phase: Phase.NIGHT_WOLF, day: next.day }));
  return { state: next, events };
}
