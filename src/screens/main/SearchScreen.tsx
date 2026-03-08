import React, {useState, useRef, useCallback, useEffect} from 'react';
import {APP_COLORS} from '../../constants';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '../../hooks/useAuth';
import {useFriends} from '../../hooks/useFriends';
import {Input} from '../../components/common/Input';
import {Avatar} from '../../components/common/Avatar';
import {QRCodeDisplay} from '../../components/qr/QRCodeDisplay';
import {QRScanner} from '../../components/qr/QRScanner';
import type {User} from '../../types';

type SearchMode = 'search' | 'myqr' | 'scan';

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();
  const {searchUsers, sendFriendRequest, pendingSent} = useFriends(
    appUser?.id,
  );

  const [mode, setMode] = useState<SearchMode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => clearTimeout(searchTimeout.current);
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim() || val.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const found = await searchUsers(val.trim());
        setResults(found);
      } finally {
        setIsSearching(false);
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
    // value should be a Supabase user ID
    if (!value || value === appUser?.id) {
      Alert.alert('Invalid QR', 'This QR code is not valid or is your own.');
      return;
    }
    Alert.alert('Send Friend Request?', `Send a friend request to this user?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Send Request',
        onPress: () => handleSendRequest(value),
      },
    ]);
  }

  const tabs: {label: string; mode: SearchMode; icon: string}[] = [
    {label: 'Search', mode: 'search', icon: '🔍'},
    {label: 'My QR', mode: 'myqr', icon: '🪪'},
    {label: 'Scan QR', mode: 'scan', icon: '📷'},
  ];

  const renderSearchItem = useCallback(
    ({item}: {item: User}) => (
      <View className="flex-row items-center bg-surface rounded-2xl p-4 mt-3 border border-border">
        <Avatar uri={item.avatar_url} name={item.display_name} size={46} />
        <View className="flex-1 ml-3">
          <Text className="font-semibold text-content-primary">
            {item.display_name}
          </Text>
          <Text className="text-sm text-content-secondary">
            @{item.username}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleSendRequest(item.id)}
          disabled={isSent(item.id) || sendingId === item.id}
          accessibilityRole="button"
          accessibilityLabel={isSent(item.id) ? 'Request sent' : `Add ${item.display_name}`}
          className={`rounded-xl px-4 py-2 ${
            isSent(item.id) ? 'bg-surface-muted border border-border' : 'bg-brand-500'
          }`}>
          {sendingId === item.id ? (
            <ActivityIndicator size="small" color={APP_COLORS.white} />
          ) : (
            <Text
              className={`text-sm font-semibold ${
                isSent(item.id) ? 'text-content-muted' : 'text-content-inverse'
              }`}>
              {isSent(item.id) ? 'Sent' : 'Add'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    ),
    [handleSendRequest, isSent, sendingId],
  );

  return (
    <View className="flex-1 bg-surface-subtle" style={{paddingTop: insets.top}}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-content-primary">Find Friends</Text>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row mx-5 bg-surface-muted rounded-2xl p-1 mb-4">
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.mode}
            onPress={() => setMode(tab.mode)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-1.5
              ${mode === tab.mode ? 'bg-surface' : ''}`}>
            <Text className="text-base">{tab.icon}</Text>
            <Text
              className={`text-sm font-semibold ${
                mode === tab.mode ? 'text-content-primary' : 'text-content-secondary'
              }`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Mode */}
      {mode === 'search' && (
        <View className="flex-1 px-5">
          <Input
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search by email or username…"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {isSearching && (
            <ActivityIndicator
              size="small"
              color={APP_COLORS.primary}
              className="mt-4"
            />
          )}

          <FlatList
            data={results}
            keyExtractor={item => item.id}
            renderItem={renderSearchItem}
            ListEmptyComponent={
              query.trim().length >= 2 && !isSearching ? (
                <Text className="text-center text-content-muted mt-8">
                  No users found
                </Text>
              ) : null
            }
          />
        </View>
      )}

      {/* My QR Mode */}
      {mode === 'myqr' && appUser && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-content-secondary mb-6 text-center">
            Share this QR code with friends so they can add you instantly
          </Text>
          <QRCodeDisplay
            value={appUser.id}
            size={240}
            label={`@${appUser.username}`}
          />
        </View>
      )}

      {/* Scan QR Mode */}
      {mode === 'scan' && (
        <View className="flex-1">
          <QRScanner onScan={handleQRScan} isActive={mode === 'scan'} />
        </View>
      )}
    </View>
  );
}
