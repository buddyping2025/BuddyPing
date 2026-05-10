import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {Radio} from 'lucide-react-native';
import {supabase} from '../../services/supabase';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {validateUsername, suggestUsername} from '../../utils/generateUsername';
import {DEFAULT_DISTANCE_THRESHOLD_METERS} from '../../constants';

export function SetupProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function handleUsernameChange(val: string) {
    const clean = val.toLowerCase().replace(/\s/g, '');
    setUsername(clean);
    setUsernameError(validateUsername(clean) ?? '');
  }

  function handleDisplayNameChange(val: string) {
    setDisplayName(val);
    if (!username) {
      setUsername(suggestUsername(val.replace(/\s/g, '')));
    }
  }

  async function handleSave() {
    if (!displayName.trim() || !username.trim()) {
      Alert.alert('Required', 'Please fill in all fields');
      return;
    }
    const err = validateUsername(username);
    if (err) {
      Alert.alert('Invalid Username', err);
      return;
    }
    setIsLoading(true);
    try {
      const {
        data: {user},
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const {error} = await supabase.from('users').insert({
        id: user.id,
        email: user.email!,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        distance_threshold_meters: DEFAULT_DISTANCE_THRESHOLD_METERS,
      });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Username Taken', 'Please choose a different username');
        } else {
          throw error;
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile');
    } finally {
      setIsLoading(false);
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
          {/* Brand logo */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: '#6366F1',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
              marginBottom: 24,
            }}>
            <Radio size={28} color="white" strokeWidth={1.5} />
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: '#111827',
            }}>
            Set Up Your Profile
          </Text>
          <Text style={{fontSize: 15, color: '#6B7280', marginTop: 6}}>
            Choose how your friends will see you
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(150)}
          style={{paddingHorizontal: 24, gap: 16}}>
          <Input
            label="Display Name"
            value={displayName}
            onChangeText={handleDisplayNameChange}
            placeholder="Alex Johnson"
            autoCapitalize="words"
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
              <Text
                style={{
                  color: '#9CA3AF',
                  fontFamily: 'monospace',
                  fontSize: 15,
                }}>
                @
              </Text>
            }
          />
          <View style={{marginTop: 8}}>
            <Button
              title="Continue"
              onPress={handleSave}
              isLoading={isLoading}
              fullWidth
            />
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
