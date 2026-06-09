import { useCallback, useEffect, useRef, useState } from 'react';
import Taro from '@tarojs/taro';
import { API_BASE } from '../config/api';
import { authHeaders } from '../utils/auth';
import {
  checkRecordPermission,
  openAppSettings,
  requestRecordPermission,
  type RecordPermissionStatus,
} from '../utils/record-permission';

export function useVoiceRecorder(gameId: string, humanSeat: number) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<RecordPermissionStatus>('unknown');
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const recorderRef = useRef<Taro.RecorderManager | null>(null);

  useEffect(() => {
    void checkRecordPermission().then(setPermissionStatus);
  }, []);

  useEffect(() => {
    recorderRef.current = Taro.getRecorderManager();
    const recorder = recorderRef.current;

    recorder.onStop((res) => {
      setRecording(false);
      if (!res.tempFilePath) return;

      setUploading(true);
      Taro.uploadFile({
        url: `${API_BASE}/api/games/${gameId}/speech/audio?humanSeatIndex=${humanSeat}&format=mp3`,
        filePath: res.tempFilePath,
        name: 'file',
        header: authHeaders(),
        success: (uploadRes) => {
          if (uploadRes.statusCode >= 400) {
            Taro.showToast({ title: '语音识别失败', icon: 'none' });
            return;
          }
          try {
            const data = JSON.parse(uploadRes.data) as { text?: string };
            if (data.text) {
              Taro.showToast({ title: `已识别: ${data.text.slice(0, 12)}`, icon: 'none' });
            }
          } catch {
            Taro.showToast({ title: '发言已提交', icon: 'success' });
          }
        },
        fail: () => {
          Taro.showToast({ title: '上传失败', icon: 'none' });
        },
        complete: () => setUploading(false),
      });
    });

    recorder.onError(() => {
      setRecording(false);
      Taro.showToast({ title: '录音失败', icon: 'none' });
    });
  }, [gameId, humanSeat]);

  const start = useCallback(() => {
    recorderRef.current?.start({
      format: 'mp3',
      sampleRate: 16000,
      numberOfChannels: 1,
    });
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const dismissPermissionGuide = useCallback(() => {
    setShowPermissionGuide(false);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const status = await requestRecordPermission();
    setPermissionStatus(status);
    if (status === 'granted') {
      setShowPermissionGuide(false);
      return true;
    }
    setShowPermissionGuide(true);
    return false;
  }, []);

  const handleOpenSettings = useCallback(() => {
    openAppSettings();
    setShowPermissionGuide(false);
    void checkRecordPermission().then(setPermissionStatus);
  }, []);

  const toggle = useCallback(async () => {
    if (recording) {
      stop();
      return;
    }

    if (permissionStatus !== 'granted') {
      const ok = await requestPermission();
      if (!ok) {
        if (permissionStatus === 'need_settings') {
          setShowPermissionGuide(true);
        }
        return;
      }
    }

    start();
  }, [recording, permissionStatus, requestPermission, start, stop]);

  return {
    recording,
    uploading,
    permissionStatus,
    showPermissionGuide,
    needSettings: permissionStatus === 'need_settings',
    dismissPermissionGuide,
    requestPermission,
    openSettings: handleOpenSettings,
    start,
    stop,
    toggle,
  };
}
