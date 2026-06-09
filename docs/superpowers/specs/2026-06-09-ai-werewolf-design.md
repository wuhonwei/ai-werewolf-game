# AI 狼人杀 — 系统设计文档

> 版本：MVP v1  
> 日期：2026-06-09  
> 状态：已批准 · M1 骨架已搭建

## 1. 项目目标

构建一款可在微信小程序运行的 AI 狼人杀游戏。MVP 支持 **1 真人 + 11 AI** 的纯单人练习模式，完成一整局预女猎守 12 人板。架构预留多人联机及 APP / 抖音小程序扩展能力。

### 1.1 MVP 范围

| 包含 | 不包含（后续迭代） |
|------|-------------------|
| 微信小程序（Taro） | 手机 APP、抖音小程序 |
| 1 真人 + 11 AI 开即玩 | 房间码、好友邀请、真人混座 |
| 预女猎守标准板 | 其他板子（引擎已预留配置） |
| 文字 + 语音交流 | 观战、回放、排行榜 |
| 每 AI 位可配置模型参数、语音、语气 | 用户自定义板子编辑器 |
| 微信登录 | 付费、道具系统 |

### 1.2 非功能需求

- 初期同时在线 ≤ 100 人（≈ 100 局）
- 单局 AI 发言延迟：P95 < 8s（含 DeepSeek 推理 + TTS）
- 服务端无单点游戏状态丢失（Redis 持久化 + 定期快照）
- 规则引擎与 AI 层解耦，可独立单测

---

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    微信小程序 (Taro + React)                   │
│  座位配置 │ 游戏主界面 │ 文字聊天 │ 录音/播放 │ AI 设置      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────┐
│                   API Gateway (Nginx)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Game Server  │  │  AI Worker    │  │  Voice Service│
│  (Node.js)    │  │  (Node.js)    │  │  (Node.js)    │
│  WebSocket    │  │  DeepSeek API │  │  阿里云 STT   │
│  状态机调度   │  │  Prompt 构建  │  │  阿里云 TTS   │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              ┌────────────────────────┐
              │  Redis (状态/队列/锁)   │
              │  PostgreSQL (用户/对局) │
              │  OSS (语音文件缓存)     │
              └────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  DeepSeek API           │
              │  阿里云语音 (STT/TTS)    │
              └─────────────────────────┘
```

### 2.1 Monorepo 结构

```
ai-werewolf-game/
├── packages/
│   ├── shared/           # 公共类型、常量、板子 JSON Schema
│   ├── engine/           # 纯 TS 规则引擎（零 IO 依赖）
│   ├── server/           # HTTP + WebSocket + 服务编排
│   └── mini-program/     # Taro 微信小程序
├── docker-compose.yml    # 本地开发：Redis + PostgreSQL
├── docs/
└── package.json          # pnpm workspace 根
```

### 2.2 核心设计原则

1. **规则引擎纯函数化** — `engine` 包只接收 action、返回新 state，不调用 AI、不访问网络。
2. **信息隔离** — 每个 AI Agent 只拿到该身份可见的信息视图（Prompt Context），绝不注入全局 state。
3. **事件驱动** — 游戏推进通过 `GameEvent` 流，前端订阅 WebSocket 事件渲染 UI。
4. **异步 AI 队列** — AI 行动走 BullMQ 任务队列，避免阻塞 WebSocket 线程。

---

## 3. 游戏规则引擎

### 3.1 预女猎守板（MVP 默认）

| 阵营 | 角色 | 数量 |
|------|------|------|
| 狼人 | 狼人 | 4 |
| 好人 | 平民 | 4 |
| 好人 | 预言家 | 1 |
| 好人 | 女巫 | 1 |
| 好人 | 猎人 | 1 |
| 好人 | 守卫 | 1 |

**关键规则（MVP 固定，配置化存储）：**

- 狼人每晚共同选刀 1 人（需 AI 协商或队长决策机制）
- 预言家每晚查验 1 人
- 女巫拥有 1 瓶解药（首夜可自救，配置项 `witch.selfSaveFirstNight: true`）、1 瓶毒药
- 守卫每晚守护 1 人，不能连续两晚守同一人
- 猎人被刀/被投出时可开枪带走 1 人
- 屠边（狼人杀光所有神或所有民）或 屠城（杀光所有好人）狼人胜；狼人全灭好人胜

### 3.2 阶段流转

```
LOBBY → ROLE_REVEAL → NIGHT_START
  ↓ (循环每夜)
  NIGHT_WOLF → NIGHT_SEER → NIGHT_WITCH → NIGHT_GUARD → NIGHT_RESOLVE
  ↓
DAY_ANNOUNCE → DAY_DISCUSS (按座位顺序发言)
  ↓
DAY_VOTE → DAY_VOTE_RESULT → (猎人开枪?) → CHECK_WIN
  ↓ (未结束)
NIGHT_START ...
  ↓ (结束)
GAME_OVER
```

每个阶段定义：

- `allowedActions: ActionType[]` — 当前可执行操作
- `timeout: number | null` — 超时秒数（MVP 单人：真人操作无硬超时，AI 有软超时）
- `visibility: VisibilityRule` — 哪些信息对哪些角色可见

### 3.3 板子配置格式（JSON Schema）

```typescript
interface BoardConfig {
  id: string;                    // "standard-12-ywlg"
  name: string;                  // "预女猎守"
  playerCount: 12;
  roles: RoleDefinition[];
  phases: PhaseDefinition[];
  winConditions: WinCondition[];
  rules: Record<string, unknown>;  // 女巫自救、守卫连守等开关
}
```

新板子 = 新 JSON 配置文件 + 引擎验证，无需改核心代码。

---

## 4. AI 玩家系统

### 4.1 信息隔离模型

每个 AI 座位维护独立的 **AgentContext**，仅包含：

| 信息类型 | 狼人 AI | 神职 AI | 平民 AI |
|----------|---------|---------|---------|
| 自己的身份 | ✅ | ✅ | ✅ |
| 狼人队友（仅狼人） | ✅ | ❌ | ❌ |
| 预言家查验结果 | ❌ | ✅（仅预言家） | ❌ |
| 女巫药水状态 | ❌ | ✅（仅女巫） | ❌ |
| 公开死亡信息 | ✅ | ✅ | ✅ |
| 所有发言/投票记录 | ✅ | ✅ | ✅ |
| **其他玩家真实身份** | **❌ 永远不可见** | **❌** | **❌** |

服务端 `ContextBuilder` 根据 `seatId + role` 从 game state 裁剪视图，再组装 Prompt。

### 4.2 AI 配置（每座位独立）

```typescript
interface AIPlayerConfig {
  seatIndex: number;           // 0-11
  model: 'deepseek-chat';      // MVP 固定，后续可扩展
  temperature: number;         // 0.3-1.0，默认 0.7
  personality: string;         // 语气描述，如"逻辑型"、"情绪化"、"简洁"
  voice: {
    provider: 'aliyun';
    voiceId: string;           // 阿里云音色 ID
    speed: number;             // 0.5-2.0
    pitch: number;
  };
}
```

### 4.3 Prompt 结构

```
[System]
你是狼人杀游戏中的 {seatNumber} 号玩家，身份是 {role}。
{personality 描述}
严格遵守：你不知道其他玩家的真实身份，只能根据公开信息推理。
当前是 {phase}，你需要 {actionHint}。

[Known Facts]
{裁剪后的私有 + 公开信息}

[Discussion History]
{按时间排序的公开发言}

[Instruction]
请输出 JSON：
{
  "thought": "内心推理（不展示给其他玩家）",
  "speech": "公开发言内容（10-80字）",
  "action": { "type": "VOTE", "target": 3 }  // 如需行动
}
```

### 4.4 狼人夜间协商

4 个狼人 AI 需要选刀同一人。MVP 方案：

1. 每个狼人 AI 独立提交 `thought + preferredTarget`
2. 服务端汇总，多数票决定；平票取狼人队长（座位号最小）的选择
3. 仅向狼人 AI 展示队友的 preferredTarget（模拟狼队私聊），不暴露给其他角色

### 4.5 AI 行动调度

```
GameServer 检测到需要 AI 行动
  → 推送 BullMQ job: { gameId, seatIndex, phase, actionType }
  → AI Worker 消费：
      1. ContextBuilder 构建 Prompt
      2. 调用 DeepSeek（流式，timeout 30s）
      3. 解析 JSON 响应，校验 action 合法性
      4. 不合法则重试 1 次（附带错误提示）
      5. 提交 action 到 engine
      6. 触发 TTS 生成 speech 音频 → 上传 OSS → 返回 URL
  → GameServer 广播 GameEvent 给前端
```

**并发控制：** 同一 gameId 的 AI job 串行执行（Redis 分布式锁），避免状态竞争。不同 gameId 可并行。

---

## 5. 语音与文字

### 5.1 文字交流

- 讨论阶段：按座位顺序发言，AI/真人发言写入 `DiscussionLog`
- 真人可随时在「自己回合」文字输入；非回合时可预输入（MVP 可简化为仅回合内）
- 所有发言对全员可见（无私信，除狼人夜间私聊由服务端内部处理）

### 5.2 语音链路

**真人 → STT：**

```
小程序 wx.getRecorderManager() 录音
  → 上传音频到 server (multipart)
  → 阿里云 STT (一句话识别 / 实时识别)
  → 返回文字 → 作为 SPEAK action 提交
```

**AI → TTS：**

```
AI 生成 speech 文本
  → 阿里云 TTS 合成 MP3
  → 上传阿里云 OSS（路径：games/{gameId}/tts/{eventId}.mp3）
  → WebSocket 推送 { type: 'SPEECH', seatIndex, text, audioUrl }
  → 小程序 InnerAudioContext 播放
```

**缓存策略：** 相同 `voiceId + text` 的 TTS 结果缓存到 OSS（hash key），减少重复合成费用。

### 5.3 微信小程序录音注意

- 需用户授权 `scope.record`
- 录音格式：`mp3` 或 `aac`，与阿里云 STT 格式对齐
- 单条录音上限 60s（讨论阶段足够）
- 播放 TTS 时暂停录音，避免回声

---

## 6. 前端设计（Taro 微信小程序）

### 6.1 页面结构

| 页面 | 功能 |
|------|------|
| `pages/index` | 首页：开始游戏、历史对局 |
| `pages/setup` | 配桌：12 座位网格，选真人位 + AI 配置 |
| `pages/game` | 游戏主界面 |
| `pages/result` | 结算页 |

### 6.2 游戏主界面布局

```
┌─────────────────────────────────┐
│  第 N 天 · 阶段：讨论中    [⚙️]  │
├─────────────────────────────────┤
│         ╭───╮                   │
│    ╭───╮│ 8 │╭───╮              │
│ ╭──╮   ╰───╯   ╭──╮             │
│ │5 │  ╭─────╮  │9 │   ← 12 座位圆环
│ ╰──╯  │ YOU │  ╰──╯             │
│       ╰─────╯                   │
├─────────────────────────────────┤
│  发言区（滚动聊天记录 + 语音播放）│
├─────────────────────────────────┤
│  [🎤 按住说话]  [文字输入框] [发送]│
│  [投票面板 / 技能面板]  ← 按阶段  │
└─────────────────────────────────┘
```

### 6.3 配桌页（Setup）

- 12 宫格座位，点击切换：真人 / AI / 空（MVP 空位自动填 AI）
- 真人座位：可选身份（MVP 支持指定或随机）
- AI 座位：弹出配置面板（语气 preset、音色选择、temperature 滑块）
- 「开始游戏」→ 调用 API 创建对局 → 跳转 game 页

### 6.4 状态管理

- `@tanstack/react-query` 管理 REST API
- WebSocket 连接由自定义 `useGameSocket` hook 管理
- 游戏 state 以服务端推送为准（Server Authoritative），前端不做规则裁决

---

## 7. 后端 API 设计

### 7.1 REST API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/wechat` | 微信 code 换 session |
| POST | `/api/games` | 创建对局（含 AI 配置、真人座位/身份） |
| GET | `/api/games/:id` | 获取对局快照（断线重连） |
| POST | `/api/games/:id/actions` | 提交玩家 action |
| POST | `/api/games/:id/speech/audio` | 上传语音 → STT |
| GET | `/api/voices` | 可用 TTS 音色列表 |

### 7.2 WebSocket 事件

**Client → Server：**

```typescript
{ type: 'JOIN', gameId: string }
{ type: 'ACTION', action: GameAction }
{ type: 'PING' }
```

**Server → Client：**

```typescript
{ type: 'STATE_SYNC', state: PublicGameState }
{ type: 'PHASE_CHANGE', phase: Phase, day: number }
{ type: 'SPEECH', seatIndex: number, text: string, audioUrl?: string }
{ type: 'ACTION_RESULT', event: GameEvent }
{ type: 'AI_THINKING', seatIndex: number }      // AI 思考中指示
{ type: 'GAME_OVER', winner: Faction, reveal: RoleReveal[] }
{ type: 'ERROR', message: string }
```

### 7.3 多人联机预留

| 概念 | MVP 实现 | 扩展方式 |
|------|----------|----------|
| Room | gameId = roomId | 增加 roomCode、maxHumans |
| Seat | seatIndex + type(human/ai) | WebSocket 按 seat 绑定 userId |
| 权限 | 唯一真人 userId | seat.userId 校验 action |
| 广播 | 单连接 | 同 gameId 多连接 fan-out |

---

## 8. 数据模型

### 8.1 PostgreSQL

```sql
-- 用户
CREATE TABLE users (
  id UUID PRIMARY KEY,
  openid VARCHAR(64) UNIQUE NOT NULL,
  nickname VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对局
CREATE TABLE games (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  board_id VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,  -- playing | finished | abandoned
  winner VARCHAR(16),
  config JSONB NOT NULL,        -- AI 配置、真人座位
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- 对局事件日志（用于回放扩展）
CREATE TABLE game_events (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  seq INT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Redis

| Key | 用途 | TTL |
|-----|------|-----|
| `game:{id}:state` | 当前完整 game state JSON | 24h |
| `game:{id}:lock` | 分布式锁 | 30s |
| `game:{id}:ws` | 活跃 WebSocket 连接标记 | session |
| `bull:ai-actions` | AI 任务队列 | — |
| `tts:cache:{hash}` | TTS 缓存 URL | 7d |

---

## 9. 部署与扩容

### 9.1 MVP 部署（100 在线）

```
阿里云 ECS × 1（2C4G）
  ├── game-server (PM2, 1 instance)
  ├── ai-worker   (PM2, 1 instance)
  └── nginx (反向代理 + WSS)

阿里云 Redis（1G 标准版）
阿里云 RDS PostgreSQL（基础版）
阿里云 OSS（TTS 音频）
```

预估：ECS ~200元/月 + Redis ~100 + RDS ~100 + API 按量

### 9.2 扩容路径（100 → 1000+）

| 阶段 | 触发条件 | 动作 |
|------|----------|------|
| 1 | CPU > 70% | game-server 水平扩展 ×N，Nginx 负载均衡 |
| 2 | AI 队列积压 | ai-worker 独立扩容（与 game-server 分离部署） |
| 3 | 1000+ 在线 | Redis Cluster、RDS 读写分离 |
| 4 | 多区域 | 按地域部署 game-server，DeepSeek/阿里云同区域 |

WebSocket  sticky session 通过 Nginx `ip_hash` 或 Redis pub/sub 跨实例广播。

---

## 10. 安全与合规

- DeepSeek API Key、阿里云密钥仅存服务端环境变量，不下发客户端
- 微信登录 session 用 JWT（HttpOnly 不适用小程序，用自定义 token + 短期过期）
- AI Prompt 中不注入用户隐私信息
- 用户录音仅用于 STT，不做持久存储（MVP）
- 内容安全：发言文本过阿里云内容安全 API（可选，MVP 建议开启）

---

## 11. 成本估算（单局）

假设一局 40 分钟，3 天 3 夜，每 AI 每轮发言 1 次：

| 项目 | 估算 |
|------|------|
| DeepSeek 调用 | ~80 次/局 × ~2K tokens ≈ ¥0.05-0.15 |
| 阿里云 TTS | ~80 条 × ~50 字 ≈ ¥0.05 |
| 阿里云 STT | 真人发言 ~20 次 ≈ ¥0.02 |
| **单局合计** | **≈ ¥0.1-0.2** |
| 100 并发（满负载） | ≈ ¥10-20/小时 API 费用 |

---

## 12. MVP 里程碑

| 阶段 | 交付物 | 预估工期 |
|------|--------|----------|
| M1 基础骨架 | monorepo、engine 包、预女猎守规则单测 | 1 周 |
| M2 后端核心 | GameServer + WebSocket + 真人 action 流转 | 1 周 |
| M3 AI 接入 | DeepSeek Agent + 信息隔离 + 队列 | 1.5 周 |
| M4 语音 | 阿里云 STT/TTS + OSS 缓存 | 1 周 |
| M5 小程序 UI | 配桌 + 游戏主界面 + 语音交互 | 1.5 周 |
| M6 联调上线 | 微信审核、部署、压测 | 1 周 |

**合计：约 7 周**（1 人全职）

---

## 13. 风险与缓解

| 风险 | 缓解 |
|------|------|
| DeepSeek 响应慢/不稳定 | 超时重试、降级为模板发言、队列背压 |
| AI 输出非法 JSON | 结构化输出 + 1 次 retry + fallback 默认 action |
| AI 「开天眼」知道他人身份 | ContextBuilder 严格裁剪 + Prompt 强调 + 单测验证 |
| 微信小程序录音权限被拒 | 降级为纯文字模式 |
| 单局 API 成本过高 | TTS 缓存、缩短 AI 发言字数上限、temperature 调低减少废话 |
| 微信审核 AI 生成内容 | 接入内容安全 API |

---

## 14. 已确认决策摘要

| 决策项 | 选择 |
|--------|------|
| MVP 平台 | 微信小程序 |
| 对局模式 | 纯单人（1 真人 + 11 AI），架构预留多人 |
| 板子 | 预女猎守，规则引擎可配置 |
| 大模型 | DeepSeek |
| 语音 | 阿里云 STT + TTS |
| 技术栈 | Taro + TypeScript + Node.js monorepo |
