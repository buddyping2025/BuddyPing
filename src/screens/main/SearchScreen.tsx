import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {FadeIn, FadeInUp, ZoomIn} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Search as SearchIcon,
  QrCode,
  Camera as CameraIcon,
  UserPlus,
  Check,
} from 'lucide-react-native';
import {useAuth} from '../../hooks/useAuth';
import {useFriends} from '../../hooks/useFriends';
import {Input} from '../../components/common/Input';
import {Avatar} from '../../components/common/Avatar';
import {QRCodeDisplay} from '../../components/qr/QRCodeDisplay';
import {QRScanner} from '../../components/qr/QRScanner';
import type {User} from '../../types';

type SearchMode = 'search' | 'myqr' | 'scan';

const TABS: {label: string; mode: SearchMode; Icon: React.ComponentType<any>}[] =
  [
    {label: 'Search', mode: 'search', Icon: SearchIcon},
    {label: 'My QR', mode: 'myqr', Icon: QrCode},
    {label: 'Scan QR', mode: 'scan', Icon: CameraIcon},
  ];

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();
  const {searchUsers, sendFriendRequest, pendingSent} = useFriends(appUser?.id);

  const [mode, setMode] = useState<SearchMode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Monotonic token so out-of-order responses from older queries don't
  // overwrite the latest result set.
  const searchTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimeout.current !== undefined) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (searchTimeout.current !== undefined) {
      clearTimeout(searchTimeout.current);
    }
    if (!val.trim() || val.trim().length < 2) {
      searchTokenRef.current += 1; // invalidate any in-flight request
      setResults([]);
      setIsSearching(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const token = ++searchTokenRef.current;
      setIsSearching(true);
      try {
        const found = await searchUsers(val.trim());
        if (token === searchTokenRef.current) {
          setResults(found);
        }
      } finally {
        if (token === searchTokenRef.current) {
          setIsSearching(false);
        }
      }
    }, 400);
  }

  const handleSendRequest = useCallback(
    async (targetUserId: string) => {
      setSendingId(targetUserId);
      try {
        await sendFriendRequest(targetUserId);
        Alert.alert('Request Sent', 'Friend request sent successfully!');
      } catch (err: any) {
        Alert.alert('Error', err.message ?? 'Could not send friend request');
      } finally {
        setSendingId(null);
      }
    },
    [sendFriendRequest],
  );

  const isSent = useCallback(
    (userId: string) => pendingSent.some(f => f.addressee_id === userId),
    [pendingSent],
  );

  async function handleQRScan(value: string) {
    const trimmed = value?.trim();
    const isUuid =
      !!trimmed &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        trimmed,
      );
    if (!isUuid) {
      Alert.alert(
        'Invalid QR',
        "This QR code doesn't look like a BuddyPing code.",
      );
      return;
    }
    if (trimmed === appUser?.id) {
      Alert.alert('That’s you!', 'You can’t add yourself as a friend.');
      return;
    }
    Alert.alert('Send Friend Request?', 'Send a friend request to this user?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Send Request', onPress: () => handleSendRequest(trimmed)},
    ]);
  }

  const renderSearchItem = useCallback(
    ({item, index}: {item: User; index: number}) => (
      <Animated.View entering={FadeInUp.duration(250).delay(index * 40)}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}>
          <Avatar uri={item.avatar_url} name={item.display_name} size={46} />
          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={{fontWeight: '600', color: '#111827'}}>
              {item.display_name}
            </Text>
            <Text style={{fontSize: 13, color: '#6B7280', marginTop: 1}}>
              @{item.username}
            </Text>
          </View>
          {isSent(item.id) ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: '#F3F4F6',
              }}>
              <Check size={14} color="#9CA3AF" />
              <Text style={{fontSize: 13, fontWeight: '600', color: '#9CA3AF'}}>
                Sent
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={() => handleSendRequest(item.id)}
              disabled={sendingId === item.id}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.display_name}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12,
                backgroundColor: '#6366F1',
                opacity: sendingId === item.id ? 0.7 : 1,
              }}>
              {sendingId === item.id ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <UserPlus size={14} color="white" />
                  <Text
                    style={{fontSize: 13, fontWeight: '600', color: 'white'}}>
                    Add
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </Animated.View>
    ),
    [handleSendRequest, isSent, sendingId],
  );

  return (
    <View
      style={{flex: 1, backgroundColor: '#F9FAFB', paddingTop: insets.top}}>
      {/* Header */}
      <View style={{paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8}}>
        <Text style={{fontSize: 22, fontWeight: '700', color: '#111827'}}>
          Find Friends
        </Text>
      </View>

      {/* Tab Switcher */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          backgroundColor: '#F3F4F6',
          borderRadius: 16,
          padding: 4,
          marginBottom: 16,
        }}>
        {TABS.map(tab => {
          const isActive = mode === tab.mode;
          return (
            <Pressable
              key={tab.mode}
              onPress={() => setMode(tab.mode)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              style={{flex: 1, position: 'relative'}}>
              {isActive && (
                <Animated.View
                  entering={ZoomIn.duration(150)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    elevation: 2,
                  }}
                />
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  gap: 5,
                }}>
                <tab.Icon
                  size={15}
                  color={isActive ? '#111827' : '#6B7280'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isActive ? '#111827' : '#6B7280',
                  }}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Tab Content */}
      {mode === 'search' && (
        <Animated.View
          key="search"
          entering={FadeIn.duration(200)}
          style={{flex: 1, paddingHorizontal: 20}}>
          <Input
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search by email or username…"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<SearchIcon size={18} color="#9CA3AF" />}
          />
          {isSearching && (
            <ActivityIndicator
              size="small"
              color="#6366F1"
              style={{marginTop: 16}}
            />
          )}
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={renderSearchItem}
            ListEmptyComponent={
              query.trim().length >= 2 && !isSearching ? (
                <Text
                  style={{
                    textAlign: 'center',
                    color: '#9CA3AF',
                    marginTop: 32,
                    fontSize: 14,
                  }}>
                  No users found
                </Text>
              ) : null
            }
          />
        </Animated.View>
      )}

      {mode === 'myqr' && appUser && (
        <Animated.View
          key="myqr"
          entering={FadeIn.duration(200)}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}>
          <Text
            style={{
              fontSize: 15,
              color: '#6B7280',
              marginBottom: 24,
              textAlign: 'center',
            }}>
            Share this QR code with friends so they can add you instantly
          </Text>
          <Animated.View entering={ZoomIn.duration(350)}>
            <QRCodeDisplay
              value={appUser.id}
              size={240}
              label={`@${appUser.username}`}
            />
          </Animated.View>
        </Animated.View>
      )}

      {mode === 'scan' && (
        <Animated.View
          key="scan"
          entering={FadeIn.duration(200)}
          style={{flex: 1}}>
          <QRScanner onScan={handleQRScan} isActive={mode === 'scan'} />
        </Animated.View>
      )}
    </View>
  );
}
