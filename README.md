# AI 狼人杀

1 真人 + 11 AI 的微信小程序狼人杀，预女猎守 12 人板。

## 技术栈

- **Monorepo:** pnpm workspaces
- **规则引擎:** `@werewolf/engine` (纯 TypeScript)
- **后端:** `@werewolf/server` (Fastify + WebSocket + JWT)
- **小程序:** `@werewolf/mini-program` (Taro 4 + React)
- **AI:** DeepSeek · **语音:** 阿里云 STT/TTS + OSS

## 环境要求

- Node.js >= 20
- pnpm >= 9（项目锁定 `pnpm@9.15.0`）
- Docker（可选，用于本地/生产 Redis + PostgreSQL）

## 快速开始（本地开发）

```bash
pnpm install
cp .env.example .env
docker compose up -d redis postgres   # 可选；需持久化用户时设 USE_POSTGRES=true
pnpm build
pnpm test
pnpm dev:server                       # http://localhost:3000
pnpm dev:mini                         # 微信小程序 dist/
```

本地默认 `AUTH_REQUIRED=false`，无需微信登录即可创局。小程序会自动 fallback 到 `POST /api/auth/dev`（生产环境该接口不可用）。

## 生产部署（Docker）

```bash
cp .env.example .env
# 必填：JWT_SECRET、WECHAT_APP_ID / WECHAT_APP_SECRET、DEEPSEEK_API_KEY
# 建议：阿里云语音 + OSS 密钥
# 设置 PUBLIC_BASE_URL=https://api.your-domain.com
# 设置 AUTH_REQUIRED=true

docker compose up -d --build
```

`docker-compose.yml` 会一并启动 **redis + postgres + server**，并默认设置 `AUTH_REQUIRED=true`、`USE_POSTGRES=true`。

服务端口：`3000`（公网需前面加 Nginx/SLB 并配置 HTTPS + WSS，见 `deploy/nginx.conf`）。

上线前 checklist 见 [`docs/deploy-checklist.md`](docs/deploy-checklist.md)。阿里云部署见 [`docs/deploy-aliyun.md`](docs/deploy-aliyun.md)。

### PM2 部署（裸机）

需自行提供 Redis、PostgreSQL，并在环境中注入 `.env` 变量：

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
GET  /health                      # 健康检查（部署探针）
GET  /api/voices                  # 可选 TTS 音色列表
POST /api/auth/wechat             # { code } → { token }
POST /api/auth/dev                 # 仅非 production
GET  /api/auth/me                  # Bearer token
POST /api/games                    # 创建对局（AUTH_REQUIRED 时需 JWT）
GET  /api/games/:id                # 获取状态
POST /api/games/:id/actions        # 提交行动
POST /api/games/:id/speech/audio   # 语音 STT
GET  /api/audio/:hash              # TTS 音频（本地或 OSS）
ws://host/ws/games/:gameId         # WebSocket 对局同步
```

## 压测 Smoke Test

```bash
pnpm dev:server
pnpm smoke http://localhost:3000 20
# 或：node scripts/smoke-test.mjs http://localhost:3000 20
```

Smoke test 使用 `/api/auth/dev` 登录，仅适用于本地或 `AUTH_REQUIRED=false` 的环境。

## 环境变量

完整列表见 `.env.example`。

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥，生产必改（32+ 位随机串） |
| `AUTH_REQUIRED` | 生产设为 `true`，强制 JWT |
| `USE_POSTGRES` | 设为 `true` 持久化微信用户 |
| `DATABASE_URL` | PostgreSQL 连接串（`USE_POSTGRES=true` 时必填） |
| `REDIS_URL` | 生产必配，多实例共享对局状态 |
| `PUBLIC_BASE_URL` | 对外 API 根 URL（TTS 音频链接） |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 微信小程序登录 |
| `ALIYUN_*` | 阿里云语音 + OSS（未配置时 TTS 走本地 fallback） |

## 文档

- 阿里云部署: [`docs/deploy-aliyun.md`](docs/deploy-aliyun.md)
- 上线 checklist: [`docs/deploy-checklist.md`](docs/deploy-checklist.md)
- 设计: [`docs/superpowers/specs/2026-06-09-ai-werewolf-design.md`](docs/superpowers/specs/2026-06-09-ai-werewolf-design.md)
- 计划: [`docs/superpowers/plans/2026-06-09-ai-werewolf-mvp.md`](docs/superpowers/plans/2026-06-09-ai-werewolf-mvp.md)
