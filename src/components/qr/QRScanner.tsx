import React, {useCallback, useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import {APP_COLORS} from '../../constants';

type Props = {
  onScan: (value: string) => void;
  isActive?: boolean;
};

export function QRScanner({onScan, isActive = true}: Props) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      codes => {
        if (scanned) return;
        const value = codes[0]?.value;
        if (value) {
          setScanned(true);
          onScan(value);
          // Reset after 2s to allow re-scanning
          setTimeout(() => setScanned(false), 2000);
        }
      },
      [onScan, scanned],
    ),
  });

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900 p-8">
        <Text className="text-white text-base text-center mb-6">
          Camera access is needed to scan QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-indigo-500 rounded-xl px-6 py-3">
          <Text className="text-white font-semibold">Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900">
        <Text className="text-white text-base">No camera found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Camera
        className="absolute inset-0"
        device={device}
        isActive={isActive && !scanned}
        codeScanner={codeScanner}
      />
      {/* Scanning overlay */}
      <View className="flex-1 items-center justify-center">
        <View
          style={{
            width: 240,
            height: 240,
            borderWidth: 3,
            borderColor: scanned ? APP_COLORS.success : APP_COLORS.primary,
            borderRadius: 20,
          }}
        />
        <Text
          className="text-white text-sm mt-4 bg-black/50 px-4 py-2 rounded-full"
          accessibilityLiveRegion="polite">
          {scanned ? 'QR code scanned!' : 'Point camera at a BuddyPing QR code'}
        </Text>
      </View>
    </View>
  );
}
