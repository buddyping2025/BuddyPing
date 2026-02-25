import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {supabase} from '../../services/supabase';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {validateUsername, suggestUsername} from '../../utils/generateUsername';
import {DEFAULT_DISTANCE_THRESHOLD_METERS} from '../../constants';

/**
 * Shown when a user has authenticated (e.g. via Google) but has no profile
 * row in public.users yet. They must choose a username before proceeding.
 */
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
          // Unique constraint violation on username
          Alert.alert('Username Taken', 'Please choose a different username');
        } else {
          throw error;
        }
      }
      // useAuth() will detect the new profile row and navigate forward
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{flexGrow: 1}}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-20 pb-8">
          <View className="mb-10">
            <Text className="text-3xl font-bold text-gray-900">
              Set Up Your Profile
            </Text>
            <Text className="text-base text-gray-500 mt-2">
              Choose how your friends will see you
            </Text>
          </View>

          <View className="gap-4 mb-8">
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
            />
          </View>

          <Button
            title="Continue"
            onPress={handleSave}
            isLoading={isLoading}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
