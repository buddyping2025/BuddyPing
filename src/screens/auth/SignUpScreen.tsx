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
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {Radio} from 'lucide-react-native';
import {supabase} from '../../services/supabase';
import {signInWithGoogle} from '../../services/googleSignIn';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {validateUsername, suggestUsername} from '../../utils/generateUsername';
import {DEFAULT_DISTANCE_THRESHOLD_METERS} from '../../constants';
import type {AuthStackParamList} from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function BrandMark() {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
      }}>
      <Radio size={28} color="white" strokeWidth={1.5} />
    </View>
  );
}

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
      const {data: authData, error: authError} = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from sign up');

      const {error: profileError} = await supabase.from('users').insert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        distance_threshold_meters: DEFAULT_DISTANCE_THRESHOLD_METERS,
      });
      if (profileError) {
        await supabase.auth.signOut();
        throw profileError;
      }
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
      style={{flex: 1, backgroundColor: '#F9FAFB'}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{paddingTop: 64, paddingBottom: 20, paddingHorizontal: 24}}>
          <BrandMark />
          <Text
            style={{
              fontSize: 30,
              fontWeight: '700',
              color: '#111827',
              marginTop: 20,
            }}>
            Create Account
          </Text>
          <Text style={{fontSize: 16, color: '#6B7280', marginTop: 6}}>
            Join BuddyPing and find your friends
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(150)}
          style={{paddingHorizontal: 24, gap: 14}}>
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
            leftIcon={
              <Text style={{color: '#9CA3AF', fontFamily: 'monospace', fontSize: 15}}>
                @
              </Text>
            }
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
          />
          <View style={{marginTop: 4}}>
            <Button
              title="Create Account"
              onPress={handleSignUp}
              isLoading={isLoading}
              fullWidth
            />
          </View>
        </Animated.View>

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 24,
            paddingHorizontal: 24,
          }}>
          <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
          <Text style={{marginHorizontal: 12, color: '#9CA3AF', fontSize: 13}}>
            or continue with
          </Text>
          <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
        </View>

        <View style={{paddingHorizontal: 24}}>
          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogleSignUp}
            isLoading={isGoogleLoading}
            fullWidth
            leftIcon={
              <Text style={{color: '#4285F4', fontWeight: '900', fontSize: 16}}>
                G
              </Text>
            }
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 28,
            marginBottom: 32,
          }}>
          <Text style={{color: '#6B7280'}}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={{color: '#6366F1', fontWeight: '600'}}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
