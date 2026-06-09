import Taro from '@tarojs/taro';
import { API_BASE } from '../config/api';

const TOKEN_KEY = 'werewolf_token';

export function getToken(): string | null {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY);
}

export async function login(): Promise<string> {
  const existing = getToken();
  if (existing) return existing;

  try {
    const { code } = await Taro.login();
    const res = await Taro.request<{ token?: string; error?: string }>({
      url: `${API_BASE}/api/auth/wechat`,
      method: 'POST',
      data: { code },
      header: { 'Content-Type': 'application/json' },
    });

    if (res.statusCode === 200 && res.data.token) {
      setToken(res.data.token);
      return res.data.token;
    }
  } catch {
    // fall through to dev login
  }

  const devRes = await Taro.request<{ token: string }>({
    url: `${API_BASE}/api/auth/dev`,
    method: 'POST',
    data: {},
    header: { 'Content-Type': 'application/json' },
  });

  if (devRes.statusCode >= 400 || !devRes.data.token) {
    throw new Error('Login failed');
  }

  setToken(devRes.data.token);
  return devRes.data.token;
}

export async function ensureLoggedIn(): Promise<void> {
  await login();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
