import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {FadeInUp, FadeOut} from 'react-native-reanimated';
import Svg, {Defs, LinearGradient, Stop, Rect} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Pencil, Radio, LogOut} from 'lucide-react-native';
import {supabase} from '../../services/supabase';
import {signOutGoogle} from '../../services/googleSignIn';
import {clearOneSignalUser} from '../../services/onesignal';
import {useAuth} from '../../hooks/useAuth';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {Avatar} from '../../components/common/Avatar';
import {SectionHeader} from '../../components/common/SectionHeader';
import {DISTANCE_PRESETS, APP_COLORS} from '../../constants';

const HEADER_HEIGHT = 220;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {appUser} = useAuth();

  const [displayName, setDisplayName] = useState(appUser?.display_name ?? '');
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
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator size="large" color={APP_COLORS.primary} />
      </View>
    );
  }

  const totalHeaderHeight = HEADER_HEIGHT + insets.top;

  return (
    <ScrollView
      style={{flex: 1, backgroundColor: '#F9FAFB'}}
      contentContainerStyle={{paddingBottom: 40}}>

      {/* Gradient Header */}
      <View style={{height: totalHeaderHeight, position: 'relative'}}>
        {/* SVG gradient background */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}>
          <Svg
            width="100%"
            height={totalHeaderHeight}>
            <Defs>
              <LinearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#6366F1" stopOpacity="1" />
                <Stop offset="1" stopColor="#312E81" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height={totalHeaderHeight}
              fill="url(#headerGrad)"
            />
          </Svg>
        </View>

        {/* Content on gradient */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingTop: insets.top + 16,
            paddingBottom: 28,
            paddingHorizontal: 24,
          }}>
          <Avatar
            uri={appUser.avatar_url}
            name={appUser.display_name}
            size={88}
            ring
          />
          <Text
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: 'white',
              marginTop: 12,
              textAlign: 'center',
            }}>
            {appUser.display_name}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.75)',
              marginTop: 2,
            }}>
            @{appUser.username}
          </Text>
          {appUser.bio ? (
            <Text
              style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.6)',
                marginTop: 6,
                textAlign: 'center',
                paddingHorizontal: 16,
              }}>
              {appUser.bio}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Edit Profile Section */}
      <View style={{marginHorizontal: 16, marginTop: 20}}>
        <SectionHeader
          title="Edit Profile"
          icon={<Pencil size={14} color="#6B7280" />}
        />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            gap: 16,
          }}>
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
      </View>

      {/* Proximity Distance Section */}
      <View style={{marginHorizontal: 16, marginTop: 20}}>
        <SectionHeader
          title="Proximity Distance"
          icon={<Radio size={14} color="#6B7280" />}
        />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#E5E7EB',
          }}>
          <Text
            style={{
              fontSize: 13,
              color: '#6B7280',
              marginBottom: 16,
              lineHeight: 20,
            }}>
            You&apos;ll be notified when a friend comes within{' '}
            <Text style={{fontWeight: '700', color: '#4F46E5'}}>
              {DISTANCE_PRESETS.find(p => p.value === threshold)?.label ??
                `${threshold / 1000} km`}
            </Text>
          </Text>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
            {DISTANCE_PRESETS.map(preset => (
              <Pressable
                key={preset.value}
                onPress={() => setThreshold(preset.value)}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{selected: threshold === preset.value}}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor:
                    threshold === preset.value ? '#6366F1' : '#E5E7EB',
                  backgroundColor:
                    threshold === preset.value ? '#6366F1' : '#F9FAFB',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color:
                      threshold === preset.value ? 'white' : '#111827',
                  }}>
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {threshold !== (appUser?.distance_threshold_meters ?? 5000) && (
            <Animated.View
              entering={FadeInUp.duration(300)}
              exiting={FadeOut.duration(200)}
              style={{marginTop: 16}}>
              <Button
                title="Save Distance Setting"
                onPress={handleSave}
                isLoading={isSaving}
                fullWidth
              />
            </Animated.View>
          )}
        </View>
      </View>

      {/* Sign Out */}
      <View
        style={{
          marginHorizontal: 16,
          marginTop: 20,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          overflow: 'hidden',
        }}>
        <Pressable
          onPress={handleSignOut}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            gap: 12,
          }}>
          <LogOut size={18} color="#EF4444" />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#EF4444',
              flex: 1,
            }}>
            Sign Out
          </Text>
          {isSigningOut && (
            <ActivityIndicator size="small" color="#EF4444" />
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
