import React from 'react';
import {View, Text, Image} from 'react-native';
import {APP_COLORS} from '../../constants';

type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
};

export function Avatar({uri, name, size = 44}: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const fontSize = Math.round(size * 0.38);

  if (uri) {
    return (
      <Image
        source={{uri}}
        style={{width: size, height: size, borderRadius: size / 2}}
        className="bg-surface-muted"
        accessibilityLabel={name ? `${name} avatar` : 'User avatar'}
        accessibilityRole="image"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: APP_COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityLabel={name ? `${name} avatar` : 'User avatar'}>
      <Text style={{fontSize, color: APP_COLORS.white, fontWeight: '700'}}>
        {initials}
      </Text>
    </View>
  );
}
