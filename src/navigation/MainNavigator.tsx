import React, {useEffect} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  Users,
  Search as SearchIcon,
  Bell,
  User,
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import {Badge} from '../components/common/Badge';
import {HomeScreen} from '../screens/main/HomeScreen';
import {SearchScreen} from '../screens/main/SearchScreen';
import {RequestsScreen} from '../screens/main/RequestsScreen';
import {ProfileScreen} from '../screens/main/ProfileScreen';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Requests: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = {
  focused: boolean;
  name: 'Home' | 'Search' | 'Requests' | 'Profile';
  badge?: number;
};

const ICONS = {
  Home: Users,
  Search: SearchIcon,
  Requests: Bell,
  Profile: User,
};

function TabIcon({focused, name, badge}: TabIconProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.12, {damping: 12, stiffness: 300});
      translateY.value = withSpring(-2, {damping: 12, stiffness: 300});
    } else {
      scale.value = withSpring(1, {damping: 12, stiffness: 300});
      translateY.value = withSpring(0, {damping: 12, stiffness: 300});
    }
  }, [focused, scale, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}, {translateY: translateY.value}],
  }));

  const IconComponent = ICONS[name];
  const color = focused ? '#6366F1' : '#9CA3AF';

  return (
    <Animated.View style={[animStyle, {alignItems: 'center'}]}>
      <IconComponent
        size={22}
        color={color}
        strokeWidth={focused ? 2.5 : 1.8}
      />
      {badge !== undefined && badge > 0 && (
        <Animated.View
          entering={ZoomIn.duration(200)}
          style={{position: 'absolute', top: -4, right: -10}}>
          <Badge count={badge} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

type MainNavigatorProps = {
  pendingRequestCount?: number;
};

export function MainNavigator({pendingRequestCount = 0}: MainNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {fontSize: 10, fontWeight: '600', marginTop: 4},
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} name="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Find',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} name="Search" />
          ),
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          tabBarLabel: 'Requests',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} name="Requests" badge={pendingRequestCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} name="Profile" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
