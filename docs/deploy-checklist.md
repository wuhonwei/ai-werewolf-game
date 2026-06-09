# 微信小程序上线 Checklist

## 服务端

- [ ] `.env` 填写 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`
- [ ] `JWT_SECRET` 使用 32+ 位随机字符串
- [ ] `AUTH_REQUIRED=true`
- [ ] `USE_POSTGRES=true` + `REDIS_URL` 已配置
- [ ] `PUBLIC_BASE_URL` 指向 HTTPS 域名
- [ ] 阿里云 TTS/STT + OSS Bucket 已创建并授权
- [ ] `docker compose up -d --build` 或 PM2 启动成功
- [ ] Nginx 配置 WSS 反向代理（见 `deploy/nginx.conf`；阿里云见 `docs/deploy-aliyun.md`）
- [ ] `node scripts/smoke-test.mjs https://api.your-domain.com 50` 通过

## 小程序

- [ ] `project.private.config.json` 填入真实 AppID
- [ ] `.env.production` 设置 `TARO_APP_API_BASE`
- [ ] `pnpm --filter @werewolf/mini-program build:weapp`
- [ ] 微信公众平台配置 request / socket / uploadFile 合法域名
- [ ] 真机测试：登录 → 创局 → 完整一局 → 语音发言

## 审核材料

- [ ] 隐私政策（含麦克风用途说明）
- [ ] 用户协议
- [ ] 游戏类目不涉及赌博/真实货币
- [ ] 服务器备案（国内域名）
