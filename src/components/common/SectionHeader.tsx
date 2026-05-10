import React from 'react';
import {View, Text} from 'react-native';

type SectionHeaderProps = {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
};

export function SectionHeader({title, icon, subtitle}: SectionHeaderProps) {
  return (
    <View style={{marginBottom: 10}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
        {icon}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text style={{fontSize: 13, color: '#9CA3AF', marginTop: 2}}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
