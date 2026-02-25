import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. ' +
      'Create a .env file based on .env.example',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use AsyncStorage so the session persists between launches and is
    // accessible from the background fetch headless task.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionFromUrl: false,
  },
});
