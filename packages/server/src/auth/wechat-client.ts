import { env } from '../config.js';

export interface WeChatSession {
  openid: string;
  sessionKey: string;
  unionid?: string;
}

export interface WeChatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export async function exchangeWeChatCode(code: string): Promise<WeChatSession> {
  if (!env.wechatAppId || !env.wechatAppSecret) {
    throw new Error('WeChat credentials not configured');
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', env.wechatAppId);
  url.searchParams.set('secret', env.wechatAppSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`WeChat API HTTP ${res.status}`);
  }

  const data = (await res.json()) as WeChatCode2SessionResponse;
  if (data.errcode || !data.openid || !data.session_key) {
    throw new Error(data.errmsg ?? `WeChat login failed (${data.errcode ?? 'unknown'})`);
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key,
    unionid: data.unionid,
  };
}
