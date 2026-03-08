import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import {APP_COLORS} from '../../constants';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

const variantClasses: Record<
  ButtonVariant,
  {container: string; text: string; spinnerColor: string}
> = {
  primary: {
    container: 'bg-brand-500 active:bg-brand-600',
    text: 'text-content-inverse font-semibold',
    spinnerColor: APP_COLORS.white,
  },
  secondary: {
    container: 'bg-surface-muted border border-border-strong active:bg-gray-200',
    text: 'text-content-primary font-semibold',
    spinnerColor: APP_COLORS.text,
  },
  danger: {
    container: 'bg-red-500 active:bg-red-600',
    text: 'text-content-inverse font-semibold',
    spinnerColor: APP_COLORS.white,
  },
  ghost: {
    container: 'active:bg-surface-muted',
    text: 'text-brand-500 font-semibold',
    spinnerColor: APP_COLORS.primary,
  },
};

export function Button({
  title,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const {container, text, spinnerColor} = variantClasses[variant];
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      className={`h-12 rounded-xl px-5 items-center justify-center flex-row gap-2
        ${container}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
      `}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{disabled: isDisabled}}
      {...props}>
      {isLoading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text className={`text-base ${text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
