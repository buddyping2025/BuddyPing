import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SignInScreen} from '../screens/auth/SignInScreen';
import {SignUpScreen} from '../screens/auth/SignUpScreen';

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{headerShown: false}}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}
