import React from 'react';
import {View, Text} from 'react-native';
import {Avatar} from '../common/Avatar';
import {formatDistance, formatRelativeTime} from '../../utils/formatDistance';
import type {FriendWithPing} from '../../types';

type Props = {
  friend: FriendWithPing;
};

export function FriendCard({friend}: Props) {
  return (
    <View
      className="flex-row items-center bg-surface rounded-2xl p-4 mb-3 border border-border"
      accessibilityLabel={`${friend.display_name}${friend.last_ping ? `, last seen ${formatRelativeTime(friend.last_ping.notified_at)} at ${formatDistance(friend.last_ping.distance_meters)}` : ', no ping yet'}`}>
      <Avatar uri={friend.avatar_url} name={friend.display_name} size={50} />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-content-primary">
          {friend.display_name}
        </Text>
        <Text className="text-sm text-content-secondary">@{friend.username}</Text>
      </View>
      <View className="items-end gap-1">
        {friend.last_ping ? (
          <>
            <View className="bg-brand-100 px-2.5 py-1 rounded-full">
              <Text className="text-xs font-semibold text-brand-600">
                {formatDistance(friend.last_ping.distance_meters)}
              </Text>
            </View>
            <Text className="text-xs text-content-muted">
              {formatRelativeTime(friend.last_ping.notified_at)}
            </Text>
          </>
        ) : (
          <Text className="text-xs text-content-muted">No ping yet</Text>
        )}
      </View>
    </View>
  );
}
