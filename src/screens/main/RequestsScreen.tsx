import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import {APP_COLORS} from '../../constants';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../../hooks/useAuth';
import {useFriends} from '../../hooks/useFriends';
import {FriendRequestCard} from '../../components/friends/FriendRequestCard';
import type {Friendship} from '../../types';

export function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();
  const {pendingReceived, isLoading, refresh, acceptRequest, declineRequest} =
    useFriends(appUser?.id);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleAccept(id: string) {
    setProcessingId(id);
    try {
      await acceptRequest(id);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not accept request');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDecline(id: string) {
    Alert.alert('Decline Request', 'Are you sure you want to decline this friend request?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setProcessingId(id);
          try {
            await declineRequest(id);
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Could not decline request');
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
  }

  const renderItem = ({item}: {item: Friendship}) => (
    <FriendRequestCard
      request={item}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );

  return (
    <View className="flex-1 bg-surface-subtle" style={{paddingTop: insets.top}}>
      <View className="px-5 pt-4 pb-3 bg-surface-subtle">
        <Text className="text-2xl font-bold text-content-primary">
          Friend Requests
        </Text>
        {pendingReceived.length > 0 && (
          <Text className="text-sm text-content-muted mt-0.5">
            {pendingReceived.length} pending
          </Text>
        )}
      </View>

      <FlatList
        data={pendingReceived}
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
            <Text className="text-5xl mb-4">📭</Text>
            <Text className="text-lg font-semibold text-content-primary">
              No pending requests
            </Text>
            <Text className="text-sm text-content-muted mt-2 text-center px-8">
              When someone sends you a friend request, it will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}
