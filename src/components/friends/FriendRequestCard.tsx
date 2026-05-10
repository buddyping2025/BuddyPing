import React from 'react';
import {View, Text, Pressable, ActivityIndicator} from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutLeft,
  LinearTransition,
} from 'react-native-reanimated';
import {UserCheck, X} from 'lucide-react-native';
import {Avatar} from '../common/Avatar';
import type {Friendship} from '../../types';

type Props = {
  request: Friendship;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  index?: number;
  isProcessing?: boolean;
};

export function FriendRequestCard({
  request,
  onAccept,
  onDecline,
  index = 0,
  isProcessing = false,
}: Props) {
  const requester = request.requester;

  return (
    <Animated.View
      entering={FadeInUp.duration(300).delay(index * 80)}
      exiting={FadeOutLeft.duration(300)}
      layout={LinearTransition.springify()}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
        <Avatar
          uri={requester?.avatar_url}
          name={requester?.display_name}
          size={50}
        />
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={{fontSize: 15, fontWeight: '600', color: '#111827'}}>
            {requester?.display_name ?? 'Unknown User'}
          </Text>
          <Text style={{fontSize: 13, color: '#6B7280', marginTop: 1}}>
            {requester?.username ? `@${requester.username}` : ''}
          </Text>
        </View>
      </View>
      <View style={{flexDirection: 'row', gap: 8}}>
        <Pressable
          onPress={() => onDecline(request.id)}
          disabled={isProcessing}
          accessibilityRole="button"
          accessibilityLabel={`Decline friend request from ${requester?.display_name ?? 'Unknown'}`}
          style={{
            flex: 1,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            flexDirection: 'row',
            gap: 6,
          }}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#6B7280" />
          ) : (
            <>
              <X size={14} color="#6B7280" />
              <Text style={{fontSize: 13, fontWeight: '600', color: '#6B7280'}}>
                Decline
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => onAccept(request.id)}
          disabled={isProcessing}
          accessibilityRole="button"
          accessibilityLabel={`Accept friend request from ${requester?.display_name ?? 'Unknown'}`}
          style={{
            flex: 1,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            backgroundColor: '#6366F1',
            flexDirection: 'row',
            gap: 6,
          }}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <UserCheck size={14} color="white" />
              <Text style={{fontSize: 13, fontWeight: '600', color: 'white'}}>
                Accept
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}
