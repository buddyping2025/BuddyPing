import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {supabase} from '../../services/supabase';
import {signInWithGoogle} from '../../services/googleSignIn';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {validateUsername, suggestUsername} from '../../utils/generateUsername';
import {DEFAULT_DISTANCE_THRESHOLD_METERS} from '../../constants';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  function handleEmailChange(val: string) {
    setEmail(val);
    if (!username) {
      setUsername(suggestUsername(val.split('@')[0]));
    }
  }

  function handleUsernameChange(val: string) {
    const clean = val.toLowerCase().replace(/\s/g, '');
    setUsername(clean);
    const err = validateUsername(clean);
    setUsernameError(err ?? '');
  }

  async function handleSignUp() {
    if (!email.trim() || !password || !displayName.trim() || !username.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const usernameErr = validateUsername(username);
    if (usernameErr) {
      Alert.alert('Invalid Username', usernameErr);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create Supabase auth user
      const {data: authData, error: authError} = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from sign up');

      // 2. Create public.users profile row
      const {error: profileError} = await supabase.from('users').insert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        distance_threshold_meters: DEFAULT_DISTANCE_THRESHOLD_METERS,
      });
      if (profileError) {
        // Rollback: delete the auth user if profile creation fails
        await supabase.auth.signOut();
        throw profileError;
      }
      // Auth state change in useAuth() will handle navigation
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err.message ?? 'Please try again');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // After Google sign-in, if no profile exists, RootNavigator shows SetupProfileScreen
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-Up Failed', err.message ?? 'Please try again');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-subtle"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-16 pb-8">
          <View className="mb-8">
            <Text className="text-4xl font-bold text-content-primary">
              Create Account
            </Text>
            <Text className="text-base text-content-secondary mt-2">
              Join BuddyPing and find your friends
            </Text>
          </View>

          <View className="gap-4 mb-6">
            <Input
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Alex Johnson"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={handleEmailChange}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="alexj123"
              autoCapitalize="none"
              autoCorrect={false}
              error={usernameError}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
            />
          </View>

          <Button
            title="Create Account"
            onPress={handleSignUp}
            isLoading={isLoading}
            fullWidth
          />

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-border" />
            <Text className="mx-3 text-content-muted text-sm">or continue with</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogleSignUp}
            isLoading={isGoogleLoading}
            fullWidth
          />

          <View className="flex-row justify-center mt-8">
            <Text className="text-content-secondary">Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text className="text-brand-500 font-semibold">Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
