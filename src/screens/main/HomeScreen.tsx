import React, {useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../../hooks/useAuth';
import {APP_COLORS} from '../../constants';
import {useFriends} from '../../hooks/useFriends';
import {FriendCard} from '../../components/friends/FriendCard';
import type {FriendWithPing} from '../../types';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();
  const {friends, isLoading, refresh} = useFriends(appUser?.id);

  const renderItem = useCallback(
    ({item}: {item: FriendWithPing}) => <FriendCard friend={item} />,
    [],
  );

  return (
    <View
      className="flex-1 bg-surface-subtle"
      style={{paddingTop: insets.top}}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 bg-surface-subtle">
        <Text className="text-2xl font-bold text-content-primary">
          {appUser ? `Hey, ${appUser.display_name.split(' ')[0]}!` : 'Friends'}
        </Text>
        {appUser && (
          <Text className="text-sm text-content-muted mt-0.5">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </Text>
        )}
      </View>

      {isLoading && friends.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={APP_COLORS.primary} />
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
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-5xl mb-4">👋</Text>
              <Text className="text-lg font-semibold text-content-primary mb-2">
                No friends yet
              </Text>
              <Text className="text-sm text-content-muted text-center px-8">
                Use the Find tab to search for friends or scan their QR code
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
