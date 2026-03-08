import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {supabase} from '../../services/supabase';
import {signOutGoogle} from '../../services/googleSignIn';
import {clearOneSignalUser} from '../../services/onesignal';
import {useAuth} from '../../hooks/useAuth';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {Avatar} from '../../components/common/Avatar';
import {DISTANCE_PRESETS, APP_COLORS} from '../../constants';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();

  const [displayName, setDisplayName] = useState(
    appUser?.display_name ?? '',
  );
  const [bio, setBio] = useState(appUser?.bio ?? '');
  const [threshold, setThreshold] = useState(
    appUser?.distance_threshold_meters ?? 5000,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSave() {
    if (!appUser || !displayName.trim()) return;
    setIsSaving(true);
    try {
      const {error} = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          distance_threshold_meters: threshold,
        })
        .eq('id', appUser.id);
      if (error) throw error;
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save profile');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            clearOneSignalUser();
            await signOutGoogle();
            await supabase.auth.signOut();
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Could not sign out');
            setIsSigningOut(false);
          }
        },
      },
    ]);
  }

  if (!appUser) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-surface-subtle"
      contentContainerStyle={{paddingBottom: 40}}
      style={{paddingTop: insets.top}}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-content-primary">Profile</Text>
      </View>

      {/* Avatar + names */}
      <View className="items-center py-6 bg-surface mx-4 mt-3 rounded-2xl border border-border">
        <Avatar
          uri={appUser.avatar_url}
          name={appUser.display_name}
          size={80}
        />
        <Text className="text-xl font-bold text-content-primary mt-3">
          {appUser.display_name}
        </Text>
        <Text className="text-sm text-content-secondary">@{appUser.username}</Text>
        <Text className="text-xs text-content-muted mt-1">{appUser.email}</Text>
      </View>

      {/* Edit Form */}
      <View className="mx-4 mt-4 bg-surface rounded-2xl p-5 border border-border gap-4">
        <Text className="text-base font-semibold text-content-primary">
          Edit Profile
        </Text>
        <Input
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
        />
        <Input
          label="Bio (optional)"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell your friends something about you…"
          multiline
          numberOfLines={3}
        />
        <Button
          title="Save Changes"
          onPress={handleSave}
          isLoading={isSaving}
          fullWidth
        />
      </View>

      {/* Distance Threshold */}
      <View className="mx-4 mt-4 bg-surface rounded-2xl p-5 border border-border">
        <Text className="text-base font-semibold text-content-primary mb-1">
          Proximity Notification Distance
        </Text>
        <Text className="text-sm text-content-secondary mb-4">
          You&apos;ll be notified when a friend comes within this distance.
          Currently:{' '}
          <Text className="font-semibold text-brand-600">
            {DISTANCE_PRESETS.find(p => p.value === threshold)?.label ??
              `${threshold / 1000} km`}
          </Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {DISTANCE_PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.value}
              onPress={() => setThreshold(preset.value)}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              accessibilityState={{selected: threshold === preset.value}}
              className={`px-4 py-2 rounded-xl border ${
                threshold === preset.value
                  ? 'bg-brand-500 border-brand-500'
                  : 'bg-surface-subtle border-border'
              }`}>
              <Text
                className={`text-sm font-semibold ${
                  threshold === preset.value
                    ? 'text-content-inverse'
                    : 'text-content-primary'
                }`}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {threshold !== (appUser?.distance_threshold_meters ?? 5000) && (
          <View className="mt-4">
            <Button
              title="Save Distance Setting"
              onPress={handleSave}
              isLoading={isSaving}
              fullWidth
            />
          </View>
        )}
      </View>

      {/* Sign Out */}
      <View className="mx-4 mt-4">
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleSignOut}
          isLoading={isSigningOut}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}
