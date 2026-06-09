import Taro from '@tarojs/taro';
import { API_BASE } from '../config/api';
import { authHeaders } from './auth';

interface ApiError {
  error?: string | Record<string, unknown>;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    data?: unknown;
    query?: Record<string, string | number>;
  } = {},
): Promise<T> {
  const { method = 'GET', data, query } = options;
  let url = `${API_BASE}${path}`;

  if (query) {
    const params = new URLSearchParams(
      Object.entries(query).map(([k, v]) => [k, String(v)]),
    );
    url += `?${params.toString()}`;
  }

  const res = await Taro.request<T & ApiError>({
    url,
    method,
    data,
    header: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
  });

  if (res.statusCode === 401) {
    throw new Error('请先登录');
  }

  if (res.statusCode >= 400) {
    const err = res.data?.error;
    const message = typeof err === 'string' ? err : 'Request failed';
    throw new Error(message);
  }

  return res.data;
}

export interface CreateGameResponse {
  gameId: string;
  publicState: {
    phase: string;
    day: number;
    seats: Array<{ index: number; alive: boolean; displayName: string }>;
  };
  humanRole: string;
}

export function createGame(payload: {
  humanSeatIndex: number;
  humanRole: string | null;
  aiConfigs: unknown[];
  seed?: number;
}) {
  return apiRequest<CreateGameResponse>('/api/games', {
    method: 'POST',
    data: payload,
  });
}
