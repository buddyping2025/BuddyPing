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
import type {AuthStackParamList} from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export function SignInScreen({navigation}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleEmailSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setIsLoading(true);
    try {
      const {error} = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // Auth state change in useAuth() will handle navigation
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message ?? 'Please try again');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign-In Failed', err.message ?? 'Please try again');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-16 pb-8">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-4xl font-bold text-gray-900">
              Welcome back
            </Text>
            <Text className="text-base text-gray-500 mt-2">
              Sign in to BuddyPing
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4 mb-6">
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
            />
          </View>

          <Button
            title="Sign In"
            onPress={handleEmailSignIn}
            isLoading={isLoading}
            fullWidth
          />

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-3 text-gray-400 text-sm">or</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Google Sign-In */}
          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            fullWidth
          />

          {/* Sign Up Link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-gray-500">Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text className="text-indigo-500 font-semibold">Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
