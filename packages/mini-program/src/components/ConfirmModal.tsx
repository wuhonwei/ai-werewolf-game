import { View, Text, Button } from '@tarojs/components';
import './ConfirmModal.scss';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!visible) return null;

  return (
    <View className="confirm-modal">
      <View className="confirm-modal__mask" onClick={onCancel} />
      <View className="confirm-modal__card">
        <Text className="confirm-modal__title">{title}</Text>
        <Text className="confirm-modal__message">{message}</Text>
        <View className="confirm-modal__actions">
          <Button className="confirm-modal__btn confirm-modal__btn--cancel" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button className="confirm-modal__btn confirm-modal__btn--confirm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </View>
      </View>
    </View>
  );
}
