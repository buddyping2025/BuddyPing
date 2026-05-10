import React, {useCallback} from 'react';
import {View, Text, Pressable} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInUp,
  LinearTransition,
} from 'react-native-reanimated';
import {Navigation, Clock, MapPin} from 'lucide-react-native';
import {Avatar} from '../common/Avatar';
import {formatDistance, formatRelativeTime} from '../../utils/formatDistance';
import type {FriendWithPing} from '../../types';

type Props = {
  friend: FriendWithPing;
  index?: number;
};

export function FriendCard({friend, index = 0}: Props) {
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, {damping: 15, stiffness: 400});
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, {damping: 15, stiffness: 400});
  }, [scale]);

  return (
    <Animated.View
      entering={FadeInUp.duration(300).delay(index * 60)}
      layout={LinearTransition.springify()}
      style={{marginBottom: 12}}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={`${friend.display_name}${
          friend.last_ping
            ? `, last seen ${formatRelativeTime(friend.last_ping.notified_at)} at ${formatDistance(friend.last_ping.distance_meters)}`
            : ', no ping yet'
        }`}>
        <Animated.View
          style={[
            pressStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            },
          ]}>
          <Avatar uri={friend.avatar_url} name={friend.display_name} size={50} />
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={{fontSize: 15, fontWeight: '600', color: '#111827'}}>
              {friend.display_name}
            </Text>
            <Text style={{fontSize: 13, color: '#6B7280', marginTop: 1}}>
              @{friend.username}
            </Text>
          </View>
          <View style={{alignItems: 'flex-end', gap: 6}}>
            {friend.last_ping ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#E0E7FF',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 99,
                    gap: 4,
                  }}>
                  <Navigation size={10} color="#4F46E5" />
                  <Text style={{fontSize: 12, fontWeight: '600', color: '#4F46E5'}}>
                    {formatDistance(friend.last_ping.distance_meters)}
                  </Text>
                </View>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
                  <Clock size={10} color="#9CA3AF" />
                  <Text style={{fontSize: 11, color: '#9CA3AF'}}>
                    {formatRelativeTime(friend.last_ping.notified_at)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={{alignItems: 'center', gap: 4}}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#F3F4F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <MapPin size={14} color="#9CA3AF" />
                </View>
                <Text style={{fontSize: 11, color: '#9CA3AF'}}>No ping</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
