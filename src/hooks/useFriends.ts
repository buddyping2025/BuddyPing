import {useState, useEffect, useCallback, useRef} from 'react';
import {supabase} from '../services/supabase';
import type {Friendship, User, FriendWithPing} from '../types';

// Escape special characters in user input that would break PostgREST's
// `.or()` filter syntax (commas, parentheses) or its ILIKE pattern syntax
// (percent, underscore). Without escaping, a query containing `,` would
// be interpreted as a logical separator and could expose unintended rows.
function escapePostgrestPattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/[,()]/g, '')
    .replace(/[%_]/g, m => `\\${m}`);
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

// Cross-instance event bus. Each useFriends() consumer (RequestsScreen,
// HomeScreen, SearchScreen, MainApp's badge counter, etc.) subscribes;
// when ANY consumer performs a mutation we ping every subscriber so they
// refetch. Without this, accepting a request in RequestsScreen would not
// decrement the badge count rendered by MainNavigator (which reads
// pendingReceived from a different useFriends instance).
const friendsRefreshListeners = new Set<() => void>();
function emitFriendsChanged() {
  friendsRefreshListeners.forEach(l => {
    try {
      l();
    } catch (err) {
      console.warn('[useFriends] listener threw:', err);
    }
  });
}

// Supabase's auto-generated TS types treat foreign-key joins as arrays
// even when the FK guarantees a single row, so we cast through unknown to
// the shapes we actually return at runtime.
type RawFriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  requester?: User | User[] | null;
  addressee?: User | User[] | null;
};

function pickRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<FriendWithPing[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Monotonic token per-instance — discards stale responses if userId
  // changes mid-fetch or if a newer fetch superseded this one.
  const fetchTokenRef = useRef(0);
  // Tracks whether the consumer is still mounted; we must not call
  // setState on an unmounted component when a slow fetch finally lands.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Bump token so any in-flight responses are discarded.
      fetchTokenRef.current += 1;
    };
  }, []);

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      // Reset state when there is no authenticated user (e.g. after
      // sign-out while a consumer is still mounted briefly).
      setFriends([]);
      setPendingReceived([]);
      setPendingSent([]);
      return;
    }
    const myToken = ++fetchTokenRef.current;
    setIsLoading(true);
    try {
      // Parallelize the three queries — they're independent of one another.
      const [acceptedRes, receivedRes, sentRes] = await Promise.all([
        supabase
          .from('friendships')
          .select(
            `
            id, requester_id, addressee_id, status, created_at,
            requester:users!requester_id(id, display_name, username, avatar_url, email, distance_threshold_meters),
            addressee:users!addressee_id(id, display_name, username, avatar_url, email, distance_threshold_meters)
          `,
          )
          .eq('status', 'accepted')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
        supabase
          .from('friendships')
          .select(
            `
            id, requester_id, addressee_id, status, created_at,
            requester:users!requester_id(id, display_name, username, avatar_url, email)
          `,
          )
          .eq('status', 'pending')
          .eq('addressee_id', userId),
        supabase
          .from('friendships')
          .select('id, requester_id, addressee_id, status, created_at')
          .eq('status', 'pending')
          .eq('requester_id', userId),
      ]);

      // Bail out if a newer fetch (or unmount) superseded this one
      // before applying results.
      if (myToken !== fetchTokenRef.current || !mountedRef.current) return;

      if (acceptedRes.error) {
        console.warn('[useFriends] accepted query error:', acceptedRes.error.message);
      }
      if (receivedRes.error) {
        console.warn('[useFriends] received query error:', receivedRes.error.message);
      }
      if (sentRes.error) {
        console.warn('[useFriends] sent query error:', sentRes.error.message);
      }

      const accepted = (acceptedRes.data ?? []) as unknown as RawFriendshipRow[];

      // Fetch last ping for each accepted pair (only if we have any
      // accepted friends — otherwise skip the round-trip entirely).
      const friendIds: string[] = [];
      accepted.forEach(f => {
        const friendId =
          f.requester_id === userId ? f.addressee_id : f.requester_id;
        if (friendId) friendIds.push(friendId);
      });

      const lastPingMap: Record<
        string,
        {notified_at: string; distance_meters: number}
      > = {};
      if (friendIds.length > 0) {
        const {data: logs, error: logsError} = await supabase
          .from('notification_logs')
          .select('friend_id, notified_at, distance_meters')
          .eq('user_id', userId)
          .in('friend_id', friendIds)
          .order('notified_at', {ascending: false});

        if (logsError) {
          // Most likely the RLS policy in migration 002 hasn't been
          // applied — fall back to empty ping data rather than crashing.
          console.warn(
            '[useFriends] notification_logs read failed:',
            logsError.message,
          );
        }

        // Discard if userId changed during the last_ping fetch.
        if (myToken !== fetchTokenRef.current || !mountedRef.current) return;

        // Keep only the most recent log per friend (rows are ordered desc).
        (logs ?? []).forEach(log => {
          if (!lastPingMap[log.friend_id]) {
            lastPingMap[log.friend_id] = {
              notified_at: log.notified_at,
              distance_meters: log.distance_meters,
            };
          }
        });
      }

      const friendList: FriendWithPing[] = [];
      for (const f of accepted) {
        const rawFriend = pickRelation<User>(
          f.requester_id === userId ? f.addressee : f.requester,
        );
        if (!rawFriend) continue;
        const last_ping = lastPingMap[rawFriend.id];
        friendList.push({...rawFriend, last_ping});
      }

      const received = ((receivedRes.data ?? []) as unknown as RawFriendshipRow[]).map(
        r => ({
          ...r,
          requester: pickRelation<User>(r.requester),
        }),
      ) as Friendship[];

      if (myToken !== fetchTokenRef.current || !mountedRef.current) return;
      setFriends(friendList);
      setPendingReceived(received);
      setPendingSent((sentRes.data ?? []) as Friendship[]);
    } catch (err) {
      // Don't surface to the user — pull-to-refresh will retry.
      console.warn('[useFriends] fetchFriends threw:', err);
    } finally {
      if (myToken === fetchTokenRef.current && mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Subscribe this instance to the cross-instance event bus so any
  // mutation anywhere triggers a refetch here.
  useEffect(() => {
    if (!userId) return;
    const listener = () => {
      fetchFriends();
    };
    friendsRefreshListeners.add(listener);
    return () => {
      friendsRefreshListeners.delete(listener);
    };
  }, [userId, fetchFriends]);

  async function sendFriendRequest(targetUserId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated');
    if (!isUuid(targetUserId)) {
      throw new Error('Invalid user ID');
    }
    if (targetUserId === userId) {
      throw new Error("You can't friend yourself");
    }

    // Check for an existing friendship in either direction. We only block
    // on accepted/pending — declined relationships should be re-requestable.
    const {data: existing} = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`,
      )
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existing) {
      throw new Error(
        existing.status === 'accepted'
          ? "You're already friends"
          : 'Friend request already exists',
      );
    }

    const {error} = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: targetUserId,
      status: 'pending',
    });
    if (error) throw error;
    emitFriendsChanged();
  }

  async function acceptRequest(friendshipId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated');
    const {error} = await supabase
      .from('friendships')
      .update({status: 'accepted'})
      .eq('id', friendshipId)
      .eq('addressee_id', userId);
    if (error) throw error;
    emitFriendsChanged();
  }

  async function declineRequest(friendshipId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated');
    const {error} = await supabase
      .from('friendships')
      .update({status: 'declined'})
      .eq('id', friendshipId)
      .eq('addressee_id', userId);
    if (error) throw error;
    emitFriendsChanged();
  }

  async function searchUsers(query: string): Promise<User[]> {
    if (!userId) return [];
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];
    const safe = escapePostgrestPattern(trimmed);
    if (!safe) return [];
    const {data, error} = await supabase
      .from('users')
      .select(
        'id, display_name, username, avatar_url, email, distance_threshold_meters',
      )
      .or(`email.ilike.%${safe}%,username.ilike.%${safe}%`)
      .neq('id', userId)
      .limit(10);
    if (error) {
      console.warn('[useFriends] searchUsers error:', error.message);
      return [];
    }
    return (data ?? []) as User[];
  }

  return {
    friends,
    pendingReceived,
    pendingSent,
    isLoading,
    refresh: fetchFriends,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    searchUsers,
  };
}
