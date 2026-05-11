import {useState, useEffect, useCallback} from 'react';
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

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // Accepted friendships with the most recent notification log per pair
      const {data: acceptedRaw} = await supabase
        .from('friendships')
        .select(
          `
          id, requester_id, addressee_id, status, created_at,
          requester:users!requester_id(id, display_name, username, avatar_url, email, distance_threshold_meters),
          addressee:users!addressee_id(id, display_name, username, avatar_url, email, distance_threshold_meters)
        `,
        )
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      const accepted = (acceptedRaw ?? []) as unknown as RawFriendshipRow[];

      // Fetch last ping for each accepted pair
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
        const {data: logs} = await supabase
          .from('notification_logs')
          .select('friend_id, notified_at, distance_meters')
          .eq('user_id', userId)
          .in('friend_id', friendIds)
          .order('notified_at', {ascending: false});

        // Keep only the most recent log per friend
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
      setFriends(friendList);

      // Pending requests received (I am the addressee)
      const {data: receivedRaw} = await supabase
        .from('friendships')
        .select(
          `
          id, requester_id, addressee_id, status, created_at,
          requester:users!requester_id(id, display_name, username, avatar_url, email)
        `,
        )
        .eq('status', 'pending')
        .eq('addressee_id', userId);

      const received = ((receivedRaw ?? []) as unknown as RawFriendshipRow[]).map(
        r => ({
          ...r,
          requester: pickRelation<User>(r.requester),
        }),
      ) as Friendship[];
      setPendingReceived(received);

      // Pending requests sent (I am the requester)
      const {data: sent} = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('status', 'pending')
        .eq('requester_id', userId);
      setPendingSent((sent ?? []) as Friendship[]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

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
    await fetchFriends();
  }

  async function acceptRequest(friendshipId: string): Promise<void> {
    const {error} = await supabase
      .from('friendships')
      .update({status: 'accepted'})
      .eq('id', friendshipId)
      .eq('addressee_id', userId);
    if (error) throw error;
    await fetchFriends();
  }

  async function declineRequest(friendshipId: string): Promise<void> {
    const {error} = await supabase
      .from('friendships')
      .update({status: 'declined'})
      .eq('id', friendshipId)
      .eq('addressee_id', userId);
    if (error) throw error;
    await fetchFriends();
  }

  async function searchUsers(query: string): Promise<User[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];
    const safe = escapePostgrestPattern(trimmed);
    if (!safe) return [];
    const {data} = await supabase
      .from('users')
      .select(
        'id, display_name, username, avatar_url, email, distance_threshold_meters',
      )
      .or(`email.ilike.%${safe}%,username.ilike.%${safe}%`)
      .neq('id', userId)
      .limit(10);
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
