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
import type {AuthStackParamList} from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

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
      style={{flex: 1, backgroundColor: '#F9FAFB'}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{paddingTop: 72, paddingBottom: 24, paddingHorizontal: 24}}>
          <BrandMark />
          <Text
            style={{
              fontSize: 30,
              fontWeight: '700',
              color: '#111827',
              marginTop: 24,
            }}>
            Welcome back
          </Text>
          <Text style={{fontSize: 16, color: '#6B7280', marginTop: 6}}>
            Sign in to continue
          </Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(150)}
          style={{
            marginHorizontal: 24,
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            elevation: 2,
            gap: 16,
          }}>
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
          <Button
            title="Sign In"
            onPress={handleEmailSignIn}
            isLoading={isLoading}
            fullWidth
          />
        </Animated.View>

        {/* Divider */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: 28,
            paddingHorizontal: 24,
          }}>
          <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
          <Text style={{marginHorizontal: 12, color: '#9CA3AF', fontSize: 13}}>
            or continue with
          </Text>
          <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}} />
        </View>

        {/* Google Sign-In */}
        <View style={{paddingHorizontal: 24}}>
          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            fullWidth
            leftIcon={
              <Text style={{color: '#4285F4', fontWeight: '900', fontSize: 16}}>
                G
              </Text>
            }
          />
        </View>

        {/* Sign Up Link */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 32,
            marginBottom: 32,
          }}>
          <Text style={{color: '#6B7280'}}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={{color: '#6366F1', fontWeight: '600'}}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
