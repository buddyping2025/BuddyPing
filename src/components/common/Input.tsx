import React, {useState, useId} from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
} from 'react-native';
import {APP_COLORS} from '../../constants';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({label, error, onFocus, onBlur, ...props}: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = useId();

  const borderColor = error
    ? APP_COLORS.danger
    : focused
    ? APP_COLORS.primary
    : APP_COLORS.border;

  return (
    <View className="w-full">
      {label && (
        <Text
          nativeID={`${inputId}-label`}
          className="text-sm font-semibold text-content-secondary mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className="bg-surface rounded-xl px-4 py-3 text-base text-content-primary"
        style={{borderWidth: 1.5, borderColor}}
        placeholderTextColor={APP_COLORS.textMuted}
        accessibilityLabelledBy={label ? `${inputId}-label` : undefined}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}
