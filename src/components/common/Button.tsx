import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<ButtonVariant, {container: string; text: string}> =
  {
    primary: {
      container: 'bg-indigo-500 active:bg-indigo-600',
      text: 'text-white font-semibold',
    },
    secondary: {
      container: 'bg-gray-100 border border-gray-300 active:bg-gray-200',
      text: 'text-gray-800 font-semibold',
    },
    danger: {
      container: 'bg-red-500 active:bg-red-600',
      text: 'text-white font-semibold',
    },
    ghost: {
      container: 'active:bg-gray-100',
      text: 'text-indigo-500 font-semibold',
    },
  };

export function Button({
  title,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  ...props
}: ButtonProps) {
  const {container, text} = variantClasses[variant];
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      className={`rounded-xl px-5 py-3.5 items-center justify-center flex-row gap-2
        ${container}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
      `}
      disabled={isDisabled}
      {...props}>
      {isLoading && <ActivityIndicator size="small" color="#fff" />}
      <Text className={`text-base ${text}`}>{title}</Text>
    </TouchableOpacity>
  );
}
