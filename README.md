# AI 狼人杀

1 真人 + 11 AI 的微信小程序狼人杀，预女猎守 12 人板。

## 技术栈

- **Monorepo:** pnpm workspaces
- **规则引擎:** `@werewolf/engine` (纯 TypeScript)
- **后端:** `@werewolf/server` (Fastify + WebSocket + JWT)
- **小程序:** `@werewolf/mini-program` (Taro 4 + React)
- **AI:** DeepSeek · **语音:** 阿里云 STT/TTS + OSS

## 快速开始（本地开发）

```bash
pnpm install
cp .env.example .env
docker compose up -d redis postgres   # 可选
pnpm build
pnpm test
pnpm dev:server                       # http://localhost:3000
pnpm dev:mini                         # 微信小程序 dist/
```

本地默认 `AUTH_REQUIRED=false`，无需微信登录即可创局。小程序会自动 fallback 到 `POST /api/auth/dev`。

## 生产部署（Docker）

```bash
cp .env.example .env
# 填写 WECHAT_APP_ID / WECHAT_APP_SECRET / DEEPSEEK_API_KEY / 阿里云密钥
# 设置 PUBLIC_BASE_URL=https://api.your-domain.com
# 设置 AUTH_REQUIRED=true

docker compose up -d --build
```

服务端口：`3000`（建议前面加 Nginx，见 `deploy/nginx.conf`）。

### PM2 部署（裸机）

```bash
pnpm build
pm2 start ecosystem.config.cjs
```

## 微信小程序配置

1. 复制 `packages/mini-program/project.private.config.example.json` → `project.private.config.json`，填入 AppID
2. 生产构建前设置 `packages/mini-program/.env.production`：
   ```
   TARO_APP_API_BASE=https://api.your-domain.com
   ```
3. 微信公众平台 → 开发管理 → 服务器域名：
   - request 合法域名：`https://api.your-domain.com`
   - socket 合法域名：`wss://api.your-domain.com`
   - uploadFile 合法域名：`https://api.your-domain.com`
4. `pnpm --filter @werewolf/mini-program build:weapp`
5. 微信开发者工具打开 `packages/mini-program/dist`

## API 速览

```bash
POST /api/auth/wechat          # { code } → { token }
POST /api/auth/dev              # 仅开发环境
GET  /api/auth/me               # Bearer token
POST /api/games                 # 创建对局（生产需 JWT）
GET  /api/games/:id             # 获取状态
POST /api/games/:id/actions     # 提交行动
POST /api/games/:id/speech/audio # 语音 STT
ws://host/ws/games/:gameId      # WebSocket
```

## 压测 Smoke Test

```bash
pnpm dev:server
node scripts/smoke-test.mjs http://localhost:3000 20
```

## 环境变量

见 `.env.example`。

| 变量 | 说明 |
|------|------|
| `AUTH_REQUIRED` | 生产设为 `true`，强制 JWT |
| `USE_POSTGRES` | 设为 `true` 持久化微信用户 |
| `REDIS_URL` | 生产必配，多实例共享对局状态 |
| `PUBLIC_BASE_URL` | 对外 API 根 URL（TTS 音频链接） |
| `ALIYUN_OSS_*` | TTS 音频 OSS 缓存 |

## 文档

- 设计: `docs/superpowers/specs/2026-06-09-ai-werewolf-design.md`
- 计划: `docs/superpowers/plans/2026-06-09-ai-werewolf-mvp.md`
