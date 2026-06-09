import { View, Text, Button } from '@tarojs/components';
import './RecordPermissionModal.scss';

export interface RecordPermissionModalProps {
  visible: boolean;
  onRequest: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
  needSettings: boolean;
}

export function RecordPermissionModal({
  visible,
  onRequest,
  onOpenSettings,
  onDismiss,
  needSettings,
}: RecordPermissionModalProps) {
  if (!visible) return null;

  return (
    <View className="record-perm-modal">
      <View className="record-perm-modal__mask" onClick={onDismiss} />
      <View className="record-perm-modal__card">
        <Text className="record-perm-modal__icon">🎙️</Text>
        <Text className="record-perm-modal__title">需要麦克风权限</Text>
        <Text className="record-perm-modal__message">
          {needSettings
            ? '您已拒绝录音权限。请在设置中开启麦克风，以便使用语音发言。'
            : '语音发言需要使用麦克风。请授权后按住「按住说话」即可录音。'}
        </Text>
        <View className="record-perm-modal__steps">
          <Text className="record-perm-modal__step">1. 点击「{needSettings ? '去设置' : '授权录音'}」</Text>
          <Text className="record-perm-modal__step">2. {needSettings ? '打开麦克风开关' : '在弹窗中选择允许'}</Text>
          <Text className="record-perm-modal__step">3. 返回游戏，再次点击录音按钮</Text>
        </View>
        <View className="record-perm-modal__actions">
          <Button className="record-perm-modal__btn record-perm-modal__btn--secondary" onClick={onDismiss}>
            暂不使用
          </Button>
          <Button
            className="record-perm-modal__btn record-perm-modal__btn--primary"
            onClick={needSettings ? onOpenSettings : onRequest}
          >
            {needSettings ? '去设置' : '授权录音'}
          </Button>
        </View>
      </View>
    </View>
  );
}
