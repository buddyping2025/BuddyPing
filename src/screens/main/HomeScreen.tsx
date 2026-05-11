import React, {useCallback} from 'react';
import {View, Text, FlatList, RefreshControl} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {UserPlus} from 'lucide-react-native';
import {useAuth} from '../../hooks/useAuth';
import {APP_COLORS} from '../../constants';
import {useFriends} from '../../hooks/useFriends';
import {FriendCard} from '../../components/friends/FriendCard';
import {FriendCardSkeleton} from '../../components/common/SkeletonLoader';
import {Avatar} from '../../components/common/Avatar';
import type {FriendWithPing} from '../../types';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();
  const {friends, isLoading, refresh} = useFriends(appUser?.id);

  const renderItem = useCallback(
    ({item, index}: {item: FriendWithPing; index: number}) => (
      <FriendCard friend={item} index={index} />
    ),
    [],
  );

  return (
    <View style={{flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top}}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: '#F9FAFB',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View>
          <Text style={{fontSize: 22, fontWeight: '700', color: '#111827'}}>
            {appUser
              ? `Hey, ${(appUser.display_name ?? '').split(' ')[0] || 'there'}!`
              : 'Friends'}
          </Text>
          {appUser && (
            <Text style={{fontSize: 13, color: '#9CA3AF', marginTop: 2}}>
              {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
            </Text>
          )}
        </View>
        {appUser && (
          <Avatar
            uri={appUser.avatar_url}
            name={appUser.display_name}
            size={36}
            ring
          />
        )}
      </View>

      {isLoading && friends.length === 0 ? (
        <View style={{paddingHorizontal: 16, paddingTop: 4}}>
          <FriendCardSkeleton />
          <FriendCardSkeleton />
          <FriendCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 20,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              tintColor={APP_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Animated.View
              entering={FadeIn.duration(400)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 80,
              }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#EEF2FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}>
                <UserPlus size={40} color="#6366F1" strokeWidth={1.5} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                }}>
                No friends yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  paddingHorizontal: 32,
                  lineHeight: 20,
                }}>
                Search for friends or share your QR code in the Find tab
              </Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}
