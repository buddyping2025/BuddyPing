import React from 'react';
import {Text} from 'react-native';
import Animated, {ZoomIn} from 'react-native-reanimated';

type BadgeProps = {
  count: number;
  max?: number;
};

export function Badge({count, max = 99}: BadgeProps) {
  if (count <= 0) return null;
  return (
    <Animated.View
      entering={ZoomIn.duration(200)}
      style={{
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
      }}>
      <Text style={{color: 'white', fontSize: 11, fontWeight: '700'}}>
        {count > max ? `${max}+` : String(count)}
      </Text>
    </Animated.View>
  );
}
