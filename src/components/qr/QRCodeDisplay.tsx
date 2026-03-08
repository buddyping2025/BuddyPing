import React from 'react';
import {View, Text} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  value: string;
  size?: number;
  label?: string;
};

export function QRCodeDisplay({value, size = 220, label}: Props) {
  return (
    <View className="items-center p-6 bg-surface rounded-2xl border border-border">
      <QRCode
        value={value}
        size={size}
        color="#111827"
        backgroundColor="#FFFFFF"
      />
      {label && (
        <Text className="text-sm text-content-secondary mt-4 text-center">{label}</Text>
      )}
      <Text
        className="text-xs text-content-muted mt-2 text-center font-mono"
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
