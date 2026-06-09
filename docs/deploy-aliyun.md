# 阿里云容器部署指南

本文说明如何将 **AI 狼人杀** 后端部署到阿里云。小程序要求 API 必须走 **HTTPS**，WebSocket 必须走 **WSS**，因此不能将 `:3000` 直接暴露到公网。

上线前请一并完成 [`deploy-checklist.md`](deploy-checklist.md) 中的检查项。

## 架构

```
微信小程序
    │  HTTPS / WSS
    ▼
SLB / ALB（443，SSL 证书）
    │
    ▼
Nginx 或 Ingress（反向代理 + WebSocket Upgrade）
    │
    ▼
server 容器（:3000，Fastify）
    ├── Redis（对局状态，多副本必配）
    ├── PostgreSQL（微信用户，USE_POSTGRES=true）
    ├── 阿里云 OSS（TTS 音频缓存，可选）
    └── DeepSeek API（AI 推理）
```

| 组件 | 项目内 | 阿里云推荐 |
|------|--------|-----------|
| 应用镜像 | `Dockerfile` | [容器镜像服务 ACR](https://www.aliyun.com/product/acr) |
| 计算 | — | [ECS](https://www.aliyun.com/product/ecs)（Compose）或 [ACK](https://www.aliyun.com/product/kubernetes)（K8s） |
| Redis | `docker-compose.yml` | 小规模随 Compose；生产用 [云数据库 Redis 版](https://www.aliyun.com/product/kvstore) |
| PostgreSQL | `docker-compose.yml` | 小规模随 Compose；生产用 [RDS PostgreSQL](https://www.aliyun.com/product/rds/postgresql) |
| 入口 | `deploy/nginx.conf` | SLB/ALB + Nginx 或 [Ingress](https://help.aliyun.com/zh/ack/ack-managed-and-ack-dedicated/user-guide/create-an-nginx-ingress-1) |
| 语音 | 代码已集成 | [智能语音交互 NLS](https://www.aliyun.com/product/nls) + [OSS](https://www.aliyun.com/product/oss) |

---

## 部署前准备

### 1. 阿里云资源

| 资源 | 用途 | 是否必须 |
|------|------|----------|
| ACR 镜像仓库 | 存放 `server` 镜像 | ACK 必须；ECS 本地 build 可跳过 |
| ECS 或 ACK 集群 | 运行容器 | 必须 |
| 域名 + SSL 证书 | HTTPS / WSS | 必须（小程序） |
| ICP 备案 | 国内域名解析 | 必须（国内服务器） |
| RDS PostgreSQL | 用户持久化 | 生产推荐 |
| 云 Redis | 对局状态共享 | 生产推荐（多副本必须） |
| OSS Bucket | TTS 音频 | 推荐 |

### 2. 生产环境变量

在服务器或 K8s Secret 中配置（完整列表见根目录 `.env.example`）：

```bash
NODE_ENV=production
PORT=3000
PUBLIC_BASE_URL=https://api.your-domain.com

AUTH_REQUIRED=true
JWT_SECRET=<32位以上随机字符串>

USE_POSTGRES=true
DATABASE_URL=postgresql://用户:密码@主机:5432/werewolf
REDIS_URL=redis://:密码@主机:6379

DEEPSEEK_API_KEY=sk-xxx

WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...

ALIYUN_ACCESS_KEY_ID=...
ALIYUN_ACCESS_KEY_SECRET=...
ALIYUN_TTS_APP_KEY=...
ALIYUN_OSS_BUCKET=your-bucket
ALIYUN_OSS_REGION=oss-cn-hangzhou
```

PostgreSQL 表结构会在服务首次启动时自动创建，无需手动迁移。

### 3. 安全组 / 防火墙

| 端口 | 说明 |
|------|------|
| 22 | SSH，仅允许运维 IP |
| 80 / 443 | 公网访问（Nginx / SLB） |
| 3000 | **不对公网开放**，仅本机或集群内网 |
| 6379 / 5432 | **不对公网开放**；使用云数据库时用内网地址 |

---

## 方案 A：ECS + Docker Compose（最快上手）

适合 MVP、单机、成本较低。直接使用项目自带的 `docker-compose.yml`（含 redis + postgres + server）。

### 步骤 1：创建 ECS

- 系统：**Alibaba Cloud Linux 3** 或 Ubuntu 22.04
- 规格：2 核 4 GB 起
- 磁盘：40 GB+
- 安全组：开放 22、80、443

### 步骤 2：安装 Docker

```bash
# Alibaba Cloud Linux 3
sudo yum install -y docker docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录 shell 后生效
```

### 步骤 3：拉代码并配置

```bash
git clone https://github.com/<你的用户名>/ai-werewolf-game.git
cd ai-werewolf-game
cp .env.example .env
vim .env   # 填入生产环境变量，PUBLIC_BASE_URL 改为 HTTPS 域名
```

### 步骤 4：启动

```bash
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:3000/health | jq .
```

期望返回包含 `"status":"ok"` 的 JSON。

### 步骤 5：Nginx + HTTPS

安装 Nginx，参考 `deploy/nginx.conf`（将 `api.example.com` 替换为你的域名）：

```nginx
upstream werewolf_backend {
  server 127.0.0.1:3000;
  keepalive 32;
}

server {
  listen 443 ssl http2;
  server_name api.your-domain.com;

  ssl_certificate     /etc/nginx/ssl/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/privkey.pem;

  client_max_body_size 10m;

  location /health {
    proxy_pass http://werewolf_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }

  location /api/ {
    proxy_pass http://werewolf_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /ws/ {
    proxy_pass http://werewolf_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }
}

server {
  listen 80;
  server_name api.your-domain.com;
  return 301 https://$host$request_uri;
}
```

SSL 证书可在 [阿里云 SSL 证书服务](https://www.aliyun.com/product/cas) 申请免费 DV 证书。

### 步骤 6：验证

```bash
curl -s https://api.your-domain.com/health
```

本地 smoke test 依赖 `/api/auth/dev`，**不适用于** `AUTH_REQUIRED=true` 的生产环境；生产验证请用微信真机走完整登录流程（见 checklist）。

---

## 方案 B：ACR + ACK（推荐生产）

适合需要多副本、滚动发布、与托管数据库配合的场景。

### 步骤 1：构建并推送镜像

```bash
# 登录 ACR（控制台 → 镜像仓库 → 访问凭证 → 登录指令）
docker login --username=<用户名> registry.cn-hangzhou.aliyuncs.com

# 在项目根目录构建
docker build -t registry.cn-hangzhou.aliyuncs.com/<命名空间>/ai-werewolf-server:latest .

docker push registry.cn-hangzhou.aliyuncs.com/<命名空间>/ai-werewolf-server:latest
```

也可在 [云效 Flow](https://flow.aliyun.com/) 或 GitHub Actions 中配置 CI，推送 tag 触发 ACK 滚动更新。

### 步骤 2：创建托管数据库

**RDS PostgreSQL**

1. 创建实例，引擎 PostgreSQL 16
2. 创建数据库 `werewolf`、账号
3. 白名单加入 ACK 节点交换机网段
4. 连接串示例：
   ```
   postgresql://werewolf:密码@pgm-xxx.pg.rds.aliyuncs.com:5432/werewolf
   ```

**云数据库 Redis**

1. 创建 Redis 实例（标准版即可）
2. 白名单同上
3. 连接串示例：
   ```
   redis://:密码@r-xxx.redis.rds.aliyuncs.com:6379
   ```

### 步骤 3：创建 K8s Secret

```bash
kubectl create namespace werewolf

kubectl create secret generic werewolf-env \
  --namespace werewolf \
  --from-literal=NODE_ENV=production \
  --from-literal=AUTH_REQUIRED=true \
  --from-literal=USE_POSTGRES=true \
  --from-literal=JWT_SECRET='你的密钥' \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=REDIS_URL='redis://...' \
  --from-literal=PUBLIC_BASE_URL='https://api.your-domain.com' \
  --from-literal=DEEPSEEK_API_KEY='...' \
  --from-literal=WECHAT_APP_ID='...' \
  --from-literal=WECHAT_APP_SECRET='...' \
  --from-literal=ALIYUN_ACCESS_KEY_ID='...' \
  --from-literal=ALIYUN_ACCESS_KEY_SECRET='...' \
  --from-literal=ALIYUN_TTS_APP_KEY='...' \
  --from-literal=ALIYUN_OSS_BUCKET='...' \
  --from-literal=ALIYUN_OSS_REGION='oss-cn-hangzhou'
```

### 步骤 4：部署应用

将以下内容保存为 `deploy/k8s/deployment.yaml` 后执行 `kubectl apply -f deploy/k8s/deployment.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: werewolf-server
  namespace: werewolf
spec:
  replicas: 2
  selector:
    matchLabels:
      app: werewolf-server
  template:
    metadata:
      labels:
        app: werewolf-server
    spec:
      containers:
        - name: server
          image: registry.cn-hangzhou.aliyuncs.com/<命名空间>/ai-werewolf-server:latest
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
          envFrom:
            - secretRef:
                name: werewolf-env
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: werewolf-server
  namespace: werewolf
spec:
  selector:
    app: werewolf-server
  ports:
    - port: 80
      targetPort: 3000
```

### 步骤 5：Ingress + HTTPS

在 ACK 控制台创建 Ingress（Nginx Ingress Controller），绑定 SLB 与 SSL 证书：

| 路径 | 后端 Service | 说明 |
|------|-------------|------|
| `/health` | `werewolf-server:80` | 健康检查 |
| `/api/` | `werewolf-server:80` | REST API |
| `/ws/` | `werewolf-server:80` | WebSocket（需 Upgrade 支持） |

Nginx Ingress 默认支持 WebSocket；若使用 ALB Ingress，请在控制台开启 WebSocket。

### 步骤 6：验证

```bash
kubectl get pods -n werewolf
kubectl logs -n werewolf -l app=werewolf-server --tail=50
curl -s https://api.your-domain.com/health
```

---

## 阿里云语音与 OSS

1. 开通 [智能语音交互](https://nls-portal.console.aliyun.com/)，创建项目，获取 **AppKey**
2. 创建 [OSS Bucket](https://oss.console.aliyun.com/)（与 ECS/ACK 同地域，如 `oss-cn-hangzhou`）
3. 为 RAM 用户授予 `AliyunNLSFullAccess` 与 OSS 读写权限（或最小权限策略）
4. 在 `.env` / Secret 中填入 `ALIYUN_*` 变量

未配置时服务仍可运行，TTS 使用本地 fallback；生产环境建议配齐 OSS 以减轻单机磁盘压力。

---

## 小程序联调

部署完成后：

1. `packages/mini-program/.env.production` 设置 `TARO_APP_API_BASE=https://api.your-domain.com`
2. 微信公众平台配置合法域名（request / socket / uploadFile 均指向该 HTTPS 域名）
3. `pnpm --filter @werewolf/mini-program build:weapp`
4. 真机测试：微信登录 → 创局 → 完整一局 → 语音发言

详见 [`deploy-checklist.md`](deploy-checklist.md)。

---

## 常见问题

**容器无法连接 RDS / Redis**

- 确认使用**内网地址**，而非公网地址
- 白名单需包含 ECS 私网 IP 或 ACK 节点网段
- Redis 6+ 若开启 ACL，连接串需带密码：`redis://:密码@host:6379`

**WebSocket 频繁断开**

- Nginx `proxy_read_timeout` 建议 ≥ 3600s（见 `deploy/nginx.conf`）
- SLB 选用支持长连接的实例；检查 Ingress idle timeout

**`/health` 正常但小程序无法登录**

- 检查 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 是否与小程序 AppID 一致
- 确认 `PUBLIC_BASE_URL` 与小程序配置的 API 域名一致（含 `https://`）

**多副本对局状态不一致**

- 必须配置共享 `REDIS_URL`；无 Redis 时各 Pod 内存独立，不可水平扩展

**镜像拉取失败（ACK）**

- 在 ACK 命名空间创建 ACR 拉取 Secret，或在 Deployment 中配置 `imagePullSecrets`

---

## 方案选型

| 场景 | 推荐 |
|------|------|
| 快速验证、预算有限 | ECS + Docker Compose |
| 正式上线、需扩容 | ACR + ACK + RDS + 云 Redis |
| 已有 ECS、暂不上 K8s | ECS Compose + 云 RDS/Redis（修改 `.env` 连接串，仅启动 server 容器） |

仅部署 server 容器时，可注释 `docker-compose.yml` 中的 redis/postgres 服务，并在 `.env` 中指向云数据库地址。
