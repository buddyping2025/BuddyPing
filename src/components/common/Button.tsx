import React, {useCallback} from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  PressableProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {APP_COLORS} from '../../constants';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  accessibilityLabel?: string;
};

const variantDefs: Record<
  ButtonVariant,
  {container: object; textColor: string; spinnerColor: string}
> = {
  primary: {
    container: {backgroundColor: '#6366F1', elevation: 2},
    textColor: '#FFFFFF',
    spinnerColor: APP_COLORS.white,
  },
  secondary: {
    container: {
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: '#D1D5DB',
    },
    textColor: '#111827',
    spinnerColor: APP_COLORS.text,
  },
  danger: {
    container: {backgroundColor: '#EF4444'},
    textColor: '#FFFFFF',
    spinnerColor: APP_COLORS.white,
  },
  ghost: {
    container: {},
    textColor: '#6366F1',
    spinnerColor: APP_COLORS.primary,
  },
};

export function Button({
  title,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  disabled,
  leftIcon,
  accessibilityLabel,
  onPress,
  ...props
}: ButtonProps) {
  const {container, textColor, spinnerColor} = variantDefs[variant];
  const isDisabled = disabled || isLoading;
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, {damping: 15, stiffness: 400});
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {damping: 15, stiffness: 400});
  }, [scale]);

  return (
    <Animated.View
      style={[
        animStyle,
        fullWidth && {width: '100%'},
        isDisabled && {opacity: 0.5},
      ]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{disabled: isDisabled}}
        style={[
          {
            height: 48,
            borderRadius: 12,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          },
          container,
        ]}
        {...props}>
        {isLoading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <>
            {leftIcon}
            <Text style={{fontSize: 16, fontWeight: '600', color: textColor}}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
