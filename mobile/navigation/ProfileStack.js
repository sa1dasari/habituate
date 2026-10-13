import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import LoginSecurityScreen from '../screens/LoginSecurityScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AccessibilityScreen from '../screens/AccessibilityScreen';
import GetHelpScreen from '../screens/GetHelpScreen';
import ReportBugScreen from '../screens/ReportBugScreen';

const Stack = createNativeStackNavigator();

// headerShown:false everywhere — every screen in this stack renders its own
// header row (StackHeader) to match the rest of the app's convention, which
// never uses React Navigation's native header bar.
export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="LoginSecurity" component={LoginSecurityScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
      <Stack.Screen name="GetHelp" component={GetHelpScreen} />
      <Stack.Screen name="ReportBug" component={ReportBugScreen} />
    </Stack.Navigator>
  );
}
