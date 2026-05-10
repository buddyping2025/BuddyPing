import React, {useState} from 'react';
import {View, Text, FlatList, RefreshControl, Alert} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';
import {APP_COLORS} from '../../constants';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MailOpen} from 'lucide-react-native';
import {useAuth} from '../../hooks/useAuth';
import {useFriends} from '../../hooks/useFriends';
import {FriendRequestCard} from '../../components/friends/FriendRequestCard';
import {RequestCardSkeleton} from '../../components/common/SkeletonLoader';
import {Badge} from '../../components/common/Badge';
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
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this friend request?',
      [
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
      ],
    );
  }

  const renderItem = ({item, index}: {item: Friendship; index: number}) => (
    <FriendRequestCard
      request={item}
      onAccept={handleAccept}
      onDecline={handleDecline}
      index={index}
      isProcessing={processingId === item.id}
    />
  );

  return (
    <View
      style={{flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top}}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: '#F9FAFB',
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
          <Text style={{fontSize: 22, fontWeight: '700', color: '#111827'}}>
            Requests
          </Text>
          {pendingReceived.length > 0 && (
            <Badge count={pendingReceived.length} />
          )}
        </View>
        {pendingReceived.length > 0 && (
          <Text style={{fontSize: 13, color: '#9CA3AF', marginTop: 2}}>
            {pendingReceived.length} pending
          </Text>
        )}
      </View>

      {isLoading && pendingReceived.length === 0 ? (
        <View style={{paddingHorizontal: 16, paddingTop: 4}}>
          <RequestCardSkeleton />
          <RequestCardSkeleton />
        </View>
      ) : (
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
                <MailOpen size={40} color="#6366F1" strokeWidth={1.5} />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 8,
                }}>
                All caught up
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  paddingHorizontal: 32,
                  lineHeight: 20,
                }}>
                New friend requests will appear here
              </Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}
