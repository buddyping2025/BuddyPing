export type User = {
  id: string; // = auth.uid() from Supabase
  email: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  distance_threshold_meters: number;
  last_location_updated_at?: string;
  onesignal_player_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at?: string;
  requester?: User;
  addressee?: User;
};

export type FriendWithPing = User & {
  last_ping?: {
    notified_at: string;
    distance_meters: number;
  };
};

