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
    <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      <Avatar
        uri={friend.avatar_url}
        name={friend.display_name}
        size={52}
      />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-gray-900">
          {friend.display_name}
        </Text>
        <Text className="text-sm text-gray-500">@{friend.username}</Text>
      </View>
      <View className="items-end">
        {friend.last_ping ? (
          <>
            <Text className="text-sm font-semibold text-indigo-600">
              {formatDistance(friend.last_ping.distance_meters)}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {formatRelativeTime(friend.last_ping.notified_at)}
            </Text>
          </>
        ) : (
          <Text className="text-xs text-gray-400">No ping yet</Text>
        )}
      </View>
    </View>
  );
}
