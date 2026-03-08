import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {supabase} from './supabase';

const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
if (!googleWebClientId) {
  throw new Error('Missing GOOGLE_WEB_CLIENT_ID environment variable');
}

export function configureGoogleSignIn(): void {
  GoogleSignin.configure({
    webClientId: googleWebClientId!,
    scopes: ['profile', 'email'],
  });
}

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});

  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;

  if (!idToken) {
    throw new Error('Google Sign-In did not return an ID token');
  }

  const {error} = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    throw error;
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore errors on Google sign-out — Supabase sign-out is what matters
  }
}

export {statusCodes};
