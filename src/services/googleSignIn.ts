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

  // google-signin v16 dropped `DEVELOPER_ERROR` from the typed statusCodes
  // surface but Android still emits code `10` (Status.DEVELOPER_ERROR) for
  // misconfigured SHA-1 / Web Client ID combos. Detect both ways.
  const DEVELOPER_ERROR_CODES = new Set<string | number>([10, '10', 'DEVELOPER_ERROR']);

  let idToken: string | undefined;
  try {
    const userInfo = await GoogleSignin.signIn();
    idToken = userInfo.data?.idToken ?? undefined;
  } catch (err: any) {
    console.warn('[googleSignIn] GoogleSignin.signIn failed', err);
    const code = err?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      const e: any = new Error('Sign-in cancelled');
      e.code = 'SIGN_IN_CANCELLED';
      throw e;
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      const e: any = new Error(
        'Google Play Services is unavailable or out of date on this device.',
      );
      e.code = 'PLAY_SERVICES_NOT_AVAILABLE';
      throw e;
    }
    if (DEVELOPER_ERROR_CODES.has(code)) {
      const e: any = new Error(
        "Google sign-in misconfigured (DEVELOPER_ERROR). The app's signing SHA-1 likely isn't registered in Firebase for package com.buddyping, or the Web Client ID doesn't match.",
      );
      e.code = 'DEVELOPER_ERROR';
      throw e;
    }
    throw err;
  }

  if (!idToken) {
    throw new Error('Google Sign-In did not return an ID token');
  }

  const {error} = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    console.warn('[googleSignIn] Supabase signInWithIdToken rejected token', error);
    const e: any = new Error(
      `Supabase rejected the Google token: ${error.message}. Check that the Google provider is enabled and the Web Client ID is listed as an Authorized Client ID in Supabase → Authentication → Providers → Google.`,
    );
    e.code = 'SUPABASE_REJECTED_TOKEN';
    throw e;
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
