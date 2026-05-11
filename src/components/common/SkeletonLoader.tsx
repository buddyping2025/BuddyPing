import React, {useEffect} from 'react';
import {View} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SkeletonProps = {
  width: number | string;
  height: number;
  borderRadius?: number;
};

export function SkeletonLoader({width, height, borderRadius = 8}: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 800}),
        withTiming(0.4, {duration: 800}),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({opacity: opacity.value}));

  return (
    <Animated.View
      style={[
        {width: width as any, height, borderRadius, backgroundColor: '#E5E7EB'},
        animStyle,
      ]}
    />
  );
}

export function FriendCardSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}>
      <SkeletonLoader width={50} height={50} borderRadius={25} />
      <View style={{flex: 1, marginLeft: 12, gap: 8}}>
        <SkeletonLoader width="60%" height={14} borderRadius={7} />
        <SkeletonLoader width="40%" height={12} borderRadius={6} />
      </View>
      <View style={{alignItems: 'flex-end', gap: 8}}>
        <SkeletonLoader width={64} height={24} borderRadius={12} />
        <SkeletonLoader width={48} height={11} borderRadius={5} />
      </View>
    </View>
  );
}

export function RequestCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}>
      <View
        style={{flexDirection: 'row', alignItems: 'center', marginBottom: 14}}>
        <SkeletonLoader width={50} height={50} borderRadius={25} />
        <View style={{flex: 1, marginLeft: 12, gap: 8}}>
          <SkeletonLoader width="55%" height={14} borderRadius={7} />
          <SkeletonLoader width="35%" height={12} borderRadius={6} />
        </View>
      </View>
      <View style={{flexDirection: 'row', gap: 8}}>
        <View style={{flex: 1}}>
          <SkeletonLoader width="100%" height={40} borderRadius={12} />
        </View>
        <View style={{flex: 1}}>
          <SkeletonLoader width="100%" height={40} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}
