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
    <View
      style={{
        alignItems: 'center',
        padding: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#C7D2FE',
      }}>
      <QRCode
        value={value}
        size={size}
        color="#4338CA"
        backgroundColor="#FFFFFF"
      />
      {label && (
        <Text
          style={{
            fontSize: 14,
            color: '#6B7280',
            marginTop: 16,
            textAlign: 'center',
            fontWeight: '600',
          }}>
          {label}
        </Text>
      )}
    </View>
  );
}
