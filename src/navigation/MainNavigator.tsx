import React from 'react';
import {Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
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
  label: string;
  icon: string;
  badge?: number;
};

function TabIcon({focused, icon, badge}: TabIconProps) {
  return (
    <Text style={{fontSize: 22, opacity: focused ? 1 : 0.5}}>
      {icon}
      {badge && badge > 0 ? ' •' : ''}
    </Text>
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
          borderTopColor: '#E5E7EB',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} label="Home" icon="👥" />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: 'Find',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} label="Search" icon="🔍" />
          ),
        }}
      />
      <Tab.Screen
        name="Requests"
        component={RequestsScreen}
        options={{
          tabBarLabel: 'Requests',
          tabBarBadge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
          tabBarIcon: ({focused}) => (
            <TabIcon
              focused={focused}
              label="Requests"
              icon="📨"
              badge={pendingRequestCount}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({focused}) => (
            <TabIcon focused={focused} label="Profile" icon="👤" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
