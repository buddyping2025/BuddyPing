import React from 'react';
import {View, Image} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Text as SvgText,
} from 'react-native-svg';

type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: boolean;
};

export function Avatar({uri, name, size = 44, ring = false}: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const fontSize = Math.round(size * 0.38);
  const r = size / 2;

  const inner = uri ? (
    <Image
      source={{uri}}
      style={{width: size, height: size, borderRadius: r}}
      accessibilityLabel={name ? `${name} avatar` : 'User avatar'}
      accessibilityRole="image"
    />
  ) : (
    <Svg
      width={size}
      height={size}
      accessibilityLabel={name ? `${name} avatar` : 'User avatar'}>
      <Defs>
        <LinearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#818CF8" stopOpacity="1" />
          <Stop offset="1" stopColor="#4338CA" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#avatarGrad)" />
      <SvgText
        x={r}
        y={r + fontSize * 0.37}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fill="white">
        {initials}
      </SvgText>
    </Svg>
  );

  if (ring) {
    return (
      <View
        style={{
          padding: 3,
          backgroundColor: 'white',
          borderRadius: r + 3,
        }}>
        {inner}
      </View>
    );
  }

  return inner;
}
