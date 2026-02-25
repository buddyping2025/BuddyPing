import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Avatar} from '../common/Avatar';
import type {Friendship, User} from '../../types';

type Props = {
  request: Friendship;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
};

export function FriendRequestCard({request, onAccept, onDecline}: Props) {
  const requester = request.requester as User;

  return (
    <View className="flex-row items-center bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
      <Avatar
        uri={requester?.avatar_url}
        name={requester?.display_name}
        size={48}
      />
      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold text-gray-900">
          {requester?.display_name ?? 'Unknown'}
        </Text>
        <Text className="text-sm text-gray-500">
          @{requester?.username ?? ''}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          onPress={() => onDecline(request.id)}
          className="bg-gray-100 rounded-xl px-3 py-2 border border-gray-200">
          <Text className="text-sm font-medium text-gray-600">Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAccept(request.id)}
          className="bg-indigo-500 rounded-xl px-3 py-2">
          <Text className="text-sm font-semibold text-white">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
