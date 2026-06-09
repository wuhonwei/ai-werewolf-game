# AI 狼人杀 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在微信小程序运行的 1 真人 + 11 AI 预女猎守狼人杀 MVP，含文字/语音交流、AI 信息隔离、可扩容后端。

**Architecture:** pnpm monorepo；`@werewolf/engine` 纯 TS 规则引擎；`@werewolf/server` Node.js WebSocket + BullMQ AI 队列；`@werewolf/mini-program` Taro 微信小程序；DeepSeek + 阿里云语音。

**Tech Stack:** TypeScript, pnpm, Vitest, Fastify, ws, BullMQ, Redis, PostgreSQL, Taro 4, React 18, DeepSeek API, 阿里云 STT/TTS/OSS

**Spec:** `docs/superpowers/specs/2026-06-09-ai-werewolf-design.md`

---

## File Map

| Package | Key Files | Responsibility |
|---------|-----------|----------------|
| `packages/shared` | `src/types/*`, `src/boards/standard-12-ywlg.ts` | 类型、板子配置、常量 |
| `packages/engine` | `src/game-engine.ts`, `src/phases/*`, `src/reducers/*` | 纯函数规则引擎 |
| `packages/server` | `src/app.ts`, `src/ws/*`, `src/services/*`, `src/workers/*` | HTTP/WS、AI、语音 |
| `packages/mini-program` | `src/pages/*`, `src/hooks/useGameSocket.ts` | Taro 微信小程序 UI |

---

## Milestone M1: Monorepo + 规则引擎（Week 1）

### Task 1: Monorepo 根配置 ✅（本 session 骨架已建）

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `docker-compose.yml`

- [x] pnpm workspace 含 4 个 package
- [x] 共享 tsconfig.base.json
- [x] docker-compose: Redis + PostgreSQL

---

### Task 2: @werewolf/shared 类型与板子配置

**Files:**
- Create: `packages/shared/src/types/game.ts`
- Create: `packages/shared/src/types/actions.ts`
- Create: `packages/shared/src/types/ai-config.ts`
- Create: `packages/shared/src/boards/standard-12-ywlg.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: 定义核心枚举与类型**

```typescript
// packages/shared/src/types/game.ts
export enum Role {
  WEREWOLF = 'werewolf',
  VILLAGER = 'villager',
  SEER = 'seer',
  WITCH = 'witch',
  HUNTER = 'hunter',
  GUARD = 'guard',
}

export enum Faction { WEREWOLF = 'werewolf', VILLAGER = 'villager' }

export enum Phase {
  LOBBY = 'lobby',
  ROLE_REVEAL = 'role_reveal',
  NIGHT_WOLF = 'night_wolf',
  NIGHT_SEER = 'night_seer',
  NIGHT_WITCH = 'night_witch',
  NIGHT_GUARD = 'night_guard',
  NIGHT_RESOLVE = 'night_resolve',
  DAY_ANNOUNCE = 'day_announce',
  DAY_DISCUSS = 'day_discuss',
  DAY_VOTE = 'day_vote',
  DAY_VOTE_RESULT = 'day_vote_result',
  HUNTER_SHOOT = 'hunter_shoot',
  CHECK_WIN = 'check_win',
  GAME_OVER = 'game_over',
}

export enum SeatType { HUMAN = 'human', AI = 'ai' }
export enum GameStatus { LOBBY = 'lobby', PLAYING = 'playing', FINISHED = 'finished' }
```

- [ ] **Step 2: 定义 BoardConfig 与预女猎守 JSON**

`standard-12-ywlg.ts` 含 12 角色数组、rules（witch.selfSaveFirstNight: true, guard.noConsecutiveGuard: true）。

- [ ] **Step 3: 定义 GameAction 联合类型**

```typescript
// packages/shared/src/types/actions.ts
export type GameAction =
  | { type: 'SPEAK'; seatIndex: number; text: string }
  | { type: 'WOLF_KILL'; seatIndex: number; target: number }
  | { type: 'SEER_CHECK'; seatIndex: number; target: number }
  | { type: 'WITCH_HEAL'; seatIndex: number; target: number | null }
  | { type: 'WITCH_POISON'; seatIndex: number; target: number | null }
  | { type: 'GUARD_PROTECT'; seatIndex: number; target: number }
  | { type: 'VOTE'; seatIndex: number; target: number }
  | { type: 'HUNTER_SHOOT'; seatIndex: number; target: number }
  | { type: 'END_SPEECH'; seatIndex: number }
  | { type: 'START_GAME' };
```

- [ ] **Step 4: Build shared package**

Run: `pnpm --filter @werewolf/shared build`
Expected: PASS, dist/ generated

---

### Task 3: @werewolf/engine 游戏创建与发牌

**Files:**
- Create: `packages/engine/src/game-engine.ts`
- Create: `packages/engine/src/create-game.ts`
- Create: `packages/engine/src/assign-roles.ts`
- Test: `packages/engine/tests/create-game.test.ts`

- [ ] **Step 1: Write failing test for createGame**

```typescript
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/create-game';
import { STANDARD_12_YWLG } from '@werewolf/shared';

describe('createGame', () => {
  it('creates 12 seats with correct role distribution', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 0,
      humanRole: null, // random
      aiSeats: [1,2,3,4,5,6,7,8,9,10,11],
      seed: 42,
    });
    expect(state.seats).toHaveLength(12);
    const roles = state.seats.map(s => s.role);
    expect(roles.filter(r => r === 'werewolf')).toHaveLength(4);
    expect(roles.filter(r => r === 'villager')).toHaveLength(4);
    expect(state.seats[0].type).toBe('human');
    expect(state.phase).toBe('role_reveal');
  });

  it('assigns specified human role when provided', () => {
    const state = createGame({
      board: STANDARD_12_YWLG,
      humanSeatIndex: 3,
      humanRole: 'seer',
      aiSeats: [0,1,2,4,5,6,7,8,9,10,11],
      seed: 1,
    });
    expect(state.seats[3].role).toBe('seer');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm --filter @werewolf/engine test`
Expected: FAIL — createGame not defined

- [ ] **Step 3: Implement createGame + assignRoles**

使用 seed 可复现 shuffle；humanRole 非空时保证该座位获得指定角色。

- [ ] **Step 4: Run test — expect PASS**

---

### Task 4: 阶段流转 — 夜间行动

**Files:**
- Create: `packages/engine/src/reducers/night.ts`
- Create: `packages/engine/src/reducers/night-resolve.ts`
- Test: `packages/engine/tests/night-phase.test.ts`

- [ ] **Step 1: Write failing test — wolf kill + guard protect + witch heal**

测试场景：狼刀 5 号，守卫守 5 号 → 5 号存活；女巫不开药。

- [ ] **Step 2: Implement night reducers**

按顺序：WOLF → SEER → WITCH → GUARD → RESOLVE（守卫优先于狼刀结算）。

- [ ] **Step 3: Test witch poison, self-save first night rule**

- [ ] **Step 4: All night tests PASS**

---

### Task 5: 白天讨论与投票

**Files:**
- Create: `packages/engine/src/reducers/day.ts`
- Test: `packages/engine/tests/day-phase.test.ts`

- [ ] **Step 1: Test speak order rotation**

12 座位按 clockwise 发言，每人 END_SPEECH 推进。

- [ ] **Step 2: Test vote tally and exile**

平票规则（MVP：平票无人出局，进入下一夜）。

- [ ] **Step 3: Test hunter shoot on exile**

- [ ] **Step 4: All day tests PASS**

---

### Task 6: 胜负判定

**Files:**
- Create: `packages/engine/src/check-win.ts`
- Test: `packages/engine/tests/check-win.test.ts`

- [ ] **Step 1: Test 屠边 — 狼人杀光所有神**

- [ ] **Step 2: Test 屠边 — 狼人杀光所有民**

- [ ] **Step 3: Test 狼人全灭**

- [ ] **Step 4: All win tests PASS**

---

### Task 7: 引擎统一入口 applyAction

**Files:**
- Modify: `packages/engine/src/game-engine.ts`
- Test: `packages/engine/tests/full-game.test.ts`

- [ ] **Step 1: Test full game simulation (scripted actions)**

用固定 seed + 预设 action 序列跑完一整局，断言 winner。

- [ ] **Step 2: applyAction validates phase + seat permissions**

非法 action 返回 `{ ok: false, error }` 不 mutate state。

- [ ] **Step 3: Export public view builder stub**

`getPublicState(state)` — 隐藏 role，仅暴露 alive/dead。

---

## Milestone M2: 后端核心（Week 2）

### Task 8: Server 基础 — Fastify + 健康检查

**Files:**
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/config.ts`

- [ ] **Step 1: Fastify app with GET /health → { status: 'ok' }**

- [ ] **Step 2: Load env via dotenv (PORT, REDIS_URL, DATABASE_URL)**

- [ ] **Step 3: Integration test with supertest**

Run: `pnpm --filter @werewolf/server test`

---

### Task 9: Redis 游戏状态存储

**Files:**
- Create: `packages/server/src/services/game-store.ts`

- [ ] **Step 1: saveGame / loadGame / deleteGame with Redis JSON**

- [ ] **Step 2: Distributed lock `withGameLock(gameId, fn)`**

- [ ] **Step 3: Unit test with ioredis-mock**

---

### Task 10: POST /api/games 创建对局

**Files:**
- Create: `packages/server/src/routes/games.ts`
- Create: `packages/server/src/services/game-service.ts`

- [ ] **Step 1: Request body schema (zod)**

```typescript
const CreateGameSchema = z.object({
  humanSeatIndex: z.number().min(0).max(11),
  humanRole: z.enum([...]).nullable(),
  aiConfigs: z.array(AIPlayerConfigSchema).length(11),
});
```

- [ ] **Step 2: Call engine createGame, persist to Redis + PG**

- [ ] **Step 3: Return { gameId, publicState }**

- [ ] **Step 4: API test**

---

### Task 11: WebSocket 游戏通道

**Files:**
- Create: `packages/server/src/ws/game-socket.ts`
- Create: `packages/server/src/ws/events.ts`

- [ ] **Step 1: Client JOIN → STATE_SYNC**

- [ ] **Step 2: Client ACTION → validate → applyAction → broadcast ACTION_RESULT + STATE_SYNC**

- [ ] **Step 3: PHASE_CHANGE broadcast on phase transition**

- [ ] **Step 4: Reconnect: JOIN with gameId → full state sync**

---

### Task 12: 阶段自动推进调度

**Files:**
- Create: `packages/server/src/services/phase-scheduler.ts`

- [ ] **Step 1: After action applied, if phase complete → advance phase**

- [ ] **Step 2: If next actor is AI → enqueue AI job (stub log for now)**

- [ ] **Step 3: If next actor is human → wait for ACTION**

---

## Milestone M3: AI 接入（Week 3–4）

### Task 13: ContextBuilder 信息隔离

**Files:**
- Create: `packages/server/src/ai/context-builder.ts`
- Test: `packages/server/tests/context-builder.test.ts`

- [ ] **Step 1: Test werewolf sees teammates, not others roles**

- [ ] **Step 2: Test seer sees own check history only**

- [ ] **Step 3: Test villager sees public info only**

- [ ] **Step 4: Assert no role leak in any context string**

---

### Task 14: DeepSeek 客户端

**Files:**
- Create: `packages/server/src/ai/deepseek-client.ts`
- Create: `packages/server/src/ai/parse-ai-response.ts`

- [ ] **Step 1: chat completion with JSON mode prompt**

- [ ] **Step 2: parse { thought, speech, action } — retry once on invalid JSON**

- [ ] **Step 3: timeout 30s, fallback template speech**

---

### Task 15: BullMQ AI Worker

**Files:**
- Create: `packages/server/src/workers/ai-worker.ts`

- [ ] **Step 1: Job payload { gameId, seatIndex, phase, actionType }**

- [ ] **Step 2: withGameLock → build context → DeepSeek → applyAction → broadcast**

- [ ] **Step 3: Emit AI_THINKING before, SPEECH after**

- [ ] **Step 4: Wolf pack coordination (majority vote)**

---

## Milestone M4: 语音（Week 5）

### Task 16: 阿里云 TTS

**Files:**
- Create: `packages/server/src/voice/tts-service.ts`
- Create: `packages/server/src/voice/oss-cache.ts`

- [ ] **Step 1: synthesize(text, voiceId) → mp3 buffer**

- [ ] **Step 2: Upload to OSS, return URL**

- [ ] **Step 3: Hash cache lookup before synthesis**

---

### Task 17: 阿里云 STT

**Files:**
- Create: `packages/server/src/voice/stt-service.ts`
- Create: `packages/server/src/routes/speech.ts`

- [ ] **Step 1: POST /api/games/:id/speech/audio multipart**

- [ ] **Step 2: STT → return { text } → client submits SPEAK action**

---

## Milestone M5: 小程序 UI（Week 5–6）

### Task 18: Taro 项目页面骨架

**Files:**
- Create: `packages/mini-program/src/pages/index/index.tsx`
- Create: `packages/mini-program/src/pages/setup/index.tsx`
- Create: `packages/mini-program/src/pages/game/index.tsx`
- Create: `packages/mini-program/src/pages/result/index.tsx`

- [ ] **Step 1: index — 开始游戏按钮 → navigate setup**

- [ ] **Step 2: setup — 12 宫格 + AI 配置弹窗**

- [ ] **Step 3: setup — POST /api/games → navigate game**

---

### Task 19: useGameSocket hook

**Files:**
- Create: `packages/mini-program/src/hooks/useGameSocket.ts`

- [ ] **Step 1: Connect WSS, handle STATE_SYNC / PHASE_CHANGE / SPEECH**

- [ ] **Step 2: sendAction helper**

- [ ] **Step 3: Reconnect on disconnect**

---

### Task 20: 游戏主界面

**Files:**
- Create: `packages/mini-program/src/components/SeatCircle.tsx`
- Create: `packages/mini-program/src/components/ChatPanel.tsx`
- Create: `packages/mini-program/src/components/ActionPanel.tsx`

- [ ] **Step 1: 12 座位圆环布局**

- [ ] **Step 2: 聊天滚动 + TTS 播放 (InnerAudioContext)**

- [ ] **Step 3: 阶段相关操作面板（投票/技能）**

---

### Task 21: 语音录制

**Files:**
- Create: `packages/mini-program/src/hooks/useVoiceRecorder.ts`

- [ ] **Step 1: wx.getRecorderManager 按住说话**

- [ ] **Step 2: Upload audio → STT → 填入输入框**

- [ ] **Step 3: 权限被拒降级文字**

---

## Milestone M6: 联调上线（Week 7）

### Task 22: 微信登录

**Files:**
- Create: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: code2session → JWT token**

- [ ] **Step 2: 小程序 wx.login → POST /api/auth/wechat**

---

### Task 23: docker-compose 全栈本地

- [ ] **Step 1: server + redis + postgres 一键启动**

- [ ] **Step 2: .env.example 文档化所有 key**

---

### Task 24: 部署与压测

- [ ] **Step 1: PM2 ecosystem.config.js**

- [ ] **Step 2: 50 并发创建对局 smoke test**

- [ ] **Step 3: 微信小程序提交审核 checklist**

---

## Spec Coverage Checklist

| Spec Section | Task |
|--------------|------|
| 预女猎守板子 | Task 2, 4, 5, 6 |
| 信息隔离 | Task 13 |
| DeepSeek | Task 14, 15 |
| 阿里云语音 | Task 16, 17, 21 |
| WebSocket 事件 | Task 11 |
| 多人预留 | Task 10 (seat.userId nullable) |
| Redis 状态 | Task 9 |
| PostgreSQL | Task 10 |
| Taro 小程序 | Task 18–21 |
| 扩容架构 | Task 15 (worker 分离), Task 24 |

---

## Current Session Scope

**M1 已完成：** 规则引擎 18 tests  
**M3 已完成（2026-06-09）：** ContextBuilder、DeepSeek 客户端、AI 编排器（异步 AI 链）、狼人协商投票，server 19 tests  
**下一步：M4** — 阿里云 TTS/STT 语音链路
