import {useState, useEffect} from 'react';
import {Session, User} from '@supabase/supabase-js';
import {supabase} from '../services/supabase';
import {setOneSignalUser, clearOneSignalUser} from '../services/onesignal';
import type {User as AppUser} from '../types';

type AuthState = {
  session: Session | null;
  supabaseUser: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get existing session on mount
    supabase.auth.getSession().then(({data: {session: s}}) => {
      setSession(s);
      if (s?.user) {
        fetchAppUser(s.user.id);
        setOneSignalUser(s.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const {data: listener} = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user) {
          fetchAppUser(s.user.id);
          setOneSignalUser(s.user.id);
        } else {
          setAppUser(null);
          clearOneSignalUser();
          setIsLoading(false);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAppUser(userId: string) {
    setIsLoading(true);
    try {
      const {data, error} = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = row not found (new user, needs profile setup)
        console.warn('[useAuth] fetchAppUser error:', error.message);
      }
      setAppUser(data ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    session,
    supabaseUser: session?.user ?? null,
    appUser,
    isLoading,
    isSignedIn: !!session,
  };
}
