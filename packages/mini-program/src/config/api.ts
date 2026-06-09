export const API_BASE =
  typeof TARO_APP_API_BASE !== 'undefined' ? TARO_APP_API_BASE : 'http://localhost:3000';

export const WS_BASE = API_BASE.replace(/^http/, 'ws');
