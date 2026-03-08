import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Avatar} from '../common/Avatar';
import type {Friendship} from '../../types';

type Props = {
  request: Friendship;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
};

export function FriendRequestCard({request, onAccept, onDecline}: Props) {
  const requester = request.requester;

  return (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
      <View className="flex-row items-center mb-3">
        <Avatar
          uri={requester?.avatar_url}
          name={requester?.display_name}
          size={46}
        />
        <View className="flex-1 ml-3">
          <Text className="text-base font-semibold text-content-primary">
            {requester?.display_name ?? 'Unknown User'}
          </Text>
          <Text className="text-sm text-content-secondary">
            {requester?.username ? `@${requester.username}` : ''}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => onDecline(request.id)}
          className="flex-1 h-10 items-center justify-center rounded-xl border border-red-300 bg-red-50"
          accessibilityRole="button"
          accessibilityLabel={`Decline friend request from ${requester?.display_name ?? 'Unknown'}`}>
          <Text className="text-sm font-semibold text-red-600">Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAccept(request.id)}
          className="flex-1 h-10 items-center justify-center rounded-xl bg-brand-500"
          accessibilityRole="button"
          accessibilityLabel={`Accept friend request from ${requester?.display_name ?? 'Unknown'}`}>
          <Text className="text-sm font-semibold text-content-inverse">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
