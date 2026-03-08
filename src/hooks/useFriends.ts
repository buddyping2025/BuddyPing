import {useState, useEffect, useCallback} from 'react';
import {supabase} from '../services/supabase';
import type {Friendship, User, FriendWithPing} from '../types';

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
      const {data: accepted} = await supabase
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

      // Fetch last ping for each accepted pair
      const friendIds: string[] = [];
      (accepted ?? []).forEach(f => {
        const friendId =
          f.requester_id === userId ? f.addressee_id : f.requester_id;
        if (friendId) friendIds.push(friendId);
      });

      let lastPingMap: Record<string, {notified_at: string; distance_meters: number}> = {};
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
      for (const f of accepted ?? []) {
        const rawFriend =
          f.requester_id === userId ? f.addressee : f.requester;
        if (!rawFriend) continue;
        const friend = rawFriend as User;
        const last_ping = lastPingMap[friend.id];
        friendList.push({...friend, last_ping});
      }
      setFriends(friendList);

      // Pending requests received (I am the addressee)
      const {data: received} = await supabase
        .from('friendships')
        .select(
          `
          id, requester_id, addressee_id, status, created_at,
          requester:users!requester_id(id, display_name, username, avatar_url, email)
        `,
        )
        .eq('status', 'pending')
        .eq('addressee_id', userId);
      setPendingReceived(received ?? []);

      // Pending requests sent (I am the requester)
      const {data: sent} = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('status', 'pending')
        .eq('requester_id', userId);
      setPendingSent(sent ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  async function sendFriendRequest(targetUserId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated');

    // Check no existing friendship in either direction
    const {data: existing} = await supabase
      .from('friendships')
      .select('id')
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`,
      )
      .single();

    if (existing) {
      throw new Error('Friend request already exists');
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
    const {data} = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url, email')
      .or(`email.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
      .neq('id', userId)
      .limit(10);
    return data ?? [];
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
