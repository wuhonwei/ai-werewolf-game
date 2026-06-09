import { describe, it, expect } from 'vitest';
import { createGame } from '@werewolf/engine';
import { Phase, Role, Faction, STANDARD_12_YWLG } from '@werewolf/shared';
import { buildPlayerHints } from '../src/services/player-hints.js';

function baseState(humanSeatIndex: number) {
  return createGame({
    board: STANDARD_12_YWLG,
    humanSeatIndex,
    humanRole: Role.SEER,
    aiSeatIndices: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== humanSeatIndex),
    seed: 42,
  });
}

describe('buildPlayerHints', () => {
  it('shows start panel at role reveal', () => {
    const state = baseState(0);
    const hints = buildPlayerHints(state, 0);
    expect(hints.panel).toBe('start');
  });

  it('shows seer panel on seer turn', () => {
    const state = { ...baseState(0), phase: Phase.NIGHT_SEER, day: 1 };
    const hints = buildPlayerHints(state, 0);
    expect(hints.panel).toBe('night_seer');
    expect(hints.isHumanTurn).toBe(true);
  });

  it('includes seer checks for seer role', () => {
    const state = {
      ...baseState(0),
      seerChecks: [{ day: 1, target: 3, result: Faction.WEREWOLF }],
    };
    const hints = buildPlayerHints(state, 0);
    expect(hints.seerChecks).toHaveLength(1);
  });

  it('shows discuss panel when human is speaker', () => {
    const state = {
      ...baseState(0),
      phase: Phase.DAY_DISCUSS,
      day: 1,
      currentSpeakerIndex: 0,
    };
    const hints = buildPlayerHints(state, 0);
    expect(hints.panel).toBe('discuss');
  });

  it('shows waiting when not human turn', () => {
    const state = {
      ...baseState(0),
      phase: Phase.NIGHT_WOLF,
      day: 1,
    };
    const hints = buildPlayerHints(state, 0);
    expect(hints.panel).toBe('waiting');
  });
});
