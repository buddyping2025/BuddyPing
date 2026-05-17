import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, Pressable} from 'react-native';
import Animated, {ZoomIn} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';
import {CheckCircle2} from 'lucide-react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';

type Props = {
  onScan: (value: string) => void;
  isActive?: boolean;
};

type CornerPos = 'tl' | 'tr' | 'bl' | 'br';

const CORNER_PATHS: Record<CornerPos, string> = {
  tl: 'M 5 24 L 5 5 L 24 5',
  tr: 'M 6 5 L 25 5 L 25 24',
  bl: 'M 5 6 L 5 25 L 24 25',
  br: 'M 6 25 L 25 25 L 25 6',
};

function CornerBracket({position, color}: {position: CornerPos; color: string}) {
  return (
    <Svg width={30} height={30}>
      <Path
        d={CORNER_PATHS[position]}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function QRScanner({onScan, isActive = true}: Props) {
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);

  // Use a ref for the "scanned" gate so the codeScanner callback stays
  // referentially stable. Recreating the codeScanner object on every
  // scan caused the underlying VisionCamera native bridge to churn.
  const scannedRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const mountedRef = useRef(true);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Clear any pending re-arm timer on unmount or when the tab is hidden
  // (isActive=false), otherwise setScanned(false) would fire on an
  // unmounted component and the next mount would briefly see scanned=true.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current !== undefined) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = undefined;
      }
    };
  }, []);

  // When the scan tab becomes inactive (user switched tabs), drop the
  // local "scanned" state so it's ready next time.
  useEffect(() => {
    if (!isActive) {
      scannedRef.current = false;
      if (resetTimerRef.current !== undefined) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = undefined;
      }
      setScanned(false);
    }
  }, [isActive]);

  const handleScanned = useCallback((codes: {value?: string}[]) => {
    if (scannedRef.current) return;
    const value = codes[0]?.value;
    if (!value) return;
    scannedRef.current = true;
    setScanned(true);
    onScanRef.current(value);
    if (resetTimerRef.current !== undefined) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = undefined;
      scannedRef.current = false;
      if (mountedRef.current) setScanned(false);
    }, 2000);
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleScanned,
  });

  if (!hasPermission) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
          padding: 32,
        }}>
        <Text
          style={{
            color: 'white',
            fontSize: 15,
            textAlign: 'center',
            marginBottom: 24,
          }}>
          Camera access is needed to scan QR codes.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: '#6366F1',
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}>
          <Text style={{color: 'white', fontWeight: '600', fontSize: 15}}>
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111827',
        }}>
        <Text style={{color: 'white', fontSize: 15}}>No camera found</Text>
      </View>
    );
  }

  const bracketColor = scanned ? '#22C55E' : '#6366F1';

  return (
    <View style={{flex: 1}}>
      <Camera
        style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
        device={device}
        isActive={isActive && !scanned}
        codeScanner={codeScanner}
      />
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        {/* Scan frame with corner brackets */}
        <View style={{width: 240, height: 240, position: 'relative'}}>
          <View style={{position: 'absolute', top: 0, left: 0}}>
            <CornerBracket position="tl" color={bracketColor} />
          </View>
          <View style={{position: 'absolute', top: 0, right: 0}}>
            <CornerBracket position="tr" color={bracketColor} />
          </View>
          <View style={{position: 'absolute', bottom: 0, left: 0}}>
            <CornerBracket position="bl" color={bracketColor} />
          </View>
          <View style={{position: 'absolute', bottom: 0, right: 0}}>
            <CornerBracket position="br" color={bracketColor} />
          </View>

          {scanned && (
            <Animated.View
              entering={ZoomIn.duration(200)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(34,197,94,0.15)',
                borderRadius: 12,
              }}>
              <CheckCircle2 size={64} color="#22C55E" />
            </Animated.View>
          )}
        </View>

        {/* Status pill */}
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 99,
            paddingHorizontal: 20,
            paddingVertical: 10,
            marginTop: 24,
          }}>
          <Text
            style={{color: 'white', fontSize: 14, fontWeight: '500'}}
            accessibilityLiveRegion="polite">
            {scanned
              ? 'QR code scanned!'
              : 'Point camera at a BuddyPing QR code'}
          </Text>
        </View>
      </View>
    </View>
  );
}
