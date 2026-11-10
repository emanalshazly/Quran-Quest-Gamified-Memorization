import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONT_SIZES } from '../constants/theme';

// Auth screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

// Main screens
import HomeScreen from '../screens/Home/HomeScreen';
import ReviewScreen from '../screens/Review/ReviewScreen';
import BattleScreen from '../screens/Battle/BattleScreen';
import LeaderboardScreen from '../screens/Leaderboard/LeaderboardScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

// Stack screens
import KidProfilesScreen from '../screens/Kids/KidProfilesScreen';
import SurahDetailScreen from '../screens/Surah/SurahDetailScreen';
import MemorizationScreen from '../screens/Surah/MemorizationScreen';
import TestScreen from '../screens/Surah/TestScreen';
import BadgesScreen from '../screens/Badges/BadgesScreen';
import ParentDashboardScreen from '../screens/Parent/ParentDashboardScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: '🗺️',
  Review: '🔁',
  Battle: '⚔️',
  Leaderboard: '🏆',
  Settings: '⚙️',
};

const TAB_LABELS = {
  Home: 'الخريطة',
  Review: 'المراجعة',
  Battle: 'التحدي',
  Leaderboard: 'الأبطال',
  Settings: 'الإعدادات',
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.card,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarLabel: TAB_LABELS[route.name],
      tabBarIcon: ({ focused }) => (
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
          {TAB_ICONS[route.name]}
        </Text>
      ),
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'خريطة المغامرة' }} />
    <Tab.Screen name="Review" component={ReviewScreen} options={{ title: 'المراجعة اليومية' }} />
    <Tab.Screen name="Battle" component={BattleScreen} options={{ title: 'وضع التحدي' }} />
    <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'لوحة الأبطال' }} />
    <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'الإعدادات' }} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>Quran Quest</Text>
        <Text style={styles.splashSubtitle}>رحلة حفظ القرآن الكريم</Text>
        <ActivityIndicator size="large" color={COLORS.secondary} style={styles.splashSpinner} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.card,
        headerBackTitleVisible: false,
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'حساب جديد' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'استعادة كلمة المرور' }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="KidProfiles" component={KidProfilesScreen} options={{ title: 'ملفات الأطفال' }} />
          <Stack.Screen name="Surah" component={SurahDetailScreen} options={{ title: 'السورة' }} />
          <Stack.Screen name="Memorization" component={MemorizationScreen} options={{ title: 'وضع الحفظ' }} />
          <Stack.Screen name="Test" component={TestScreen} options={{ title: 'وضع الاختبار' }} />
          <Stack.Screen name="Badges" component={BadgesScreen} options={{ title: 'الشارات' }} />
          <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} options={{ title: 'لوحة الوالدين' }} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTitle: {
    fontSize: FONT_SIZES.huge,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  splashSubtitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.secondary,
    marginTop: 8,
  },
  splashSpinner: {
    marginTop: 24,
  },
});

export default AppNavigator;
