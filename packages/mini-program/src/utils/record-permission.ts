import Taro from '@tarojs/taro';

export type RecordPermissionStatus = 'unknown' | 'granted' | 'denied' | 'need_settings';

export async function checkRecordPermission(): Promise<RecordPermissionStatus> {
  try {
    const { authSetting } = await Taro.getSetting();
    const record = authSetting['scope.record'];
    if (record === true) return 'granted';
    if (record === false) return 'need_settings';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function requestRecordPermission(): Promise<RecordPermissionStatus> {
  const current = await checkRecordPermission();
  if (current === 'granted') return 'granted';

  if (current === 'need_settings') {
    return 'need_settings';
  }

  try {
    await Taro.authorize({ scope: 'scope.record' });
    return 'granted';
  } catch {
    return 'need_settings';
  }
}

export function openAppSettings(): void {
  void Taro.openSetting({});
}
