import React, {useId} from 'react';
import {View, Text, TextInput, TextInputProps} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import {AlertCircle} from 'lucide-react-native';
import {APP_COLORS} from '../../constants';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
};

export function Input({
  label,
  error,
  leftIcon,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const inputId = useId();
  const focusProgress = useSharedValue(0);

  const borderAnimStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? APP_COLORS.danger
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [APP_COLORS.border, APP_COLORS.primary],
        );
    const backgroundColor = interpolateColor(
      focusProgress.value,
      [0, 1],
      ['#F9FAFB', '#FFFFFF'],
    );
    return {borderColor, backgroundColor};
  });

  return (
    <View style={{width: '100%'}}>
      {label && (
        <Text
          nativeID={`${inputId}-label`}
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#6B7280',
            marginBottom: 6,
          }}>
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          {
            borderWidth: 1.5,
            borderRadius: 12,
            position: 'relative',
          },
          borderAnimStyle,
        ]}>
        {leftIcon && (
          <View
            style={{
              position: 'absolute',
              left: 14,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              zIndex: 1,
            }}>
            {leftIcon}
          </View>
        )}
        <TextInput
          nativeID={inputId}
          accessibilityLabelledBy={label ? `${inputId}-label` : undefined}
          style={{
            paddingHorizontal: leftIcon ? 44 : 16,
            paddingVertical: 12,
            fontSize: 16,
            color: '#111827',
            backgroundColor: 'transparent',
          }}
          placeholderTextColor={APP_COLORS.textMuted}
          onFocus={e => {
            focusProgress.value = withTiming(1, {duration: 150});
            onFocus?.(e);
          }}
          onBlur={e => {
            focusProgress.value = withTiming(0, {duration: 150});
            onBlur?.(e);
          }}
          {...props}
        />
      </Animated.View>
      {error && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
          }}
          accessibilityLiveRegion="polite">
          <AlertCircle size={12} color="#EF4444" />
          <Text style={{fontSize: 13, color: '#EF4444'}}>{error}</Text>
        </View>
      )}
    </View>
  );
}
