import React from 'react';
import {View, Text, Image} from 'react-native';

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
        className="bg-gray-200"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{fontSize, color: '#fff', fontWeight: '700'}}>
        {initials}
      </Text>
    </View>
  );
}
