import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kidsAPI } from '../services/api';
import { useAuth } from './AuthContext';
import {
  syncReviewReminders,
  cancelReviewReminders,
  requestNotificationPermission,
} from '../services/notifications';
import { DEFAULT_REMINDER_HOUR } from '../utils/reminderSchedule';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedKid, setSelectedKid] = useState(null);
  const [kids, setKids] = useState([]);
  const [language, setLanguage] = useState('ar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kidsLoaded, setKidsLoaded] = useState(false);
  const [remindersEnabled, setRemindersEnabledState] = useState(false);
  const [reminderHour, setReminderHourState] = useState(DEFAULT_REMINDER_HOUR);

  useEffect(() => {
    loadAppSettings();
  }, []);

  // (Re)load kids whenever the user becomes authenticated — including
  // first-time users with no previously selected kid.
  useEffect(() => {
    if (isAuthenticated) {
      AsyncStorage.getItem('app.selectedKidId')
        .then(savedKidId => loadKids(savedKidId))
        .catch(() => loadKids());
    } else {
      setKids([]);
      setSelectedKid(null);
      setKidsLoaded(false);
    }
  }, [isAuthenticated]);

  const syncReminders = useCallback(
    () => syncReviewReminders({ kids, enabled: remindersEnabled, reminderHour }),
    [kids, remindersEnabled, reminderHour]
  );

  // Keep the scheduled review reminders in step with the kid list and the
  // reminder settings. Nothing is touched until the saved state has loaded,
  // so reminders already scheduled survive an app start without a connection.
  useEffect(() => {
    if (loading || authLoading) return;
    if (!isAuthenticated) {
      cancelReviewReminders();
      return;
    }
    if (!kidsLoaded) return;
    syncReminders();
  }, [loading, authLoading, isAuthenticated, kidsLoaded, syncReminders]);

  const loadAppSettings = async () => {
    try {
      const [savedLanguage, savedTheme, savedReminders, savedReminderHour] = await Promise.all([
        AsyncStorage.getItem('app.language'),
        AsyncStorage.getItem('app.darkMode'),
        AsyncStorage.getItem('app.remindersEnabled'),
        AsyncStorage.getItem('app.reminderHour'),
      ]);

      if (savedLanguage) setLanguage(savedLanguage);
      if (savedTheme) setIsDarkMode(savedTheme === 'true');
      if (savedReminders) setRemindersEnabledState(savedReminders === 'true');
      const hour = parseInt(savedReminderHour, 10);
      if (hour >= 0 && hour <= 23) setReminderHourState(hour);
    } catch (error) {
      console.error('Error loading app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKids = async (selectedKidId = null) => {
    try {
      const response = await kidsAPI.getAll();
      if (response.success) {
        setKids(response.kids);
        setKidsLoaded(true);

        // Set selected kid
        if (selectedKidId) {
          const kid = response.kids.find(k => k.id === selectedKidId);
          if (kid) setSelectedKid(kid);
        } else if (response.kids.length > 0) {
          setSelectedKid(response.kids[0]);
        }
      }
    } catch (error) {
      console.error('Error loading kids:', error);
    }
  };

  const selectKid = async (kid) => {
    setSelectedKid(kid);
    await AsyncStorage.setItem('app.selectedKidId', kid.id);
  };

  const addKid = async (kidData) => {
    try {
      const response = await kidsAPI.create(kidData);
      if (response.success) {
        setKids([...kids, response.kid]);
        if (!selectedKid) {
          await selectKid(response.kid);
        }
        return { success: true, kid: response.kid };
      }
      return { success: false, error: 'Failed to create kid profile' };
    } catch (error) {
      console.error('Error adding kid:', error);
      return { success: false, error: error.message };
    }
  };

  const updateKid = async (kidId, kidData) => {
    try {
      const response = await kidsAPI.update(kidId, kidData);
      if (response.success) {
        const updatedKids = kids.map(k =>
          k.id === kidId ? response.kid : k
        );
        setKids(updatedKids);

        if (selectedKid?.id === kidId) {
          setSelectedKid(response.kid);
        }

        return { success: true, kid: response.kid };
      }
      return { success: false, error: 'Failed to update kid profile' };
    } catch (error) {
      console.error('Error updating kid:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteKid = async (kidId) => {
    try {
      const response = await kidsAPI.delete(kidId);
      if (response.success) {
        const updatedKids = kids.filter(k => k.id !== kidId);
        setKids(updatedKids);

        if (selectedKid?.id === kidId) {
          setSelectedKid(updatedKids[0] || null);
        }

        return { success: true };
      }
      return { success: false, error: 'Failed to delete kid profile' };
    } catch (error) {
      console.error('Error deleting kid:', error);
      return { success: false, error: error.message };
    }
  };

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem('app.language', lang);
  };

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    await AsyncStorage.setItem('app.darkMode', newMode.toString());
  };

  // Turning reminders on asks the OS for permission; resolves to false if
  // the parent declines, in which case reminders stay off.
  const setRemindersEnabled = async (enabled) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) return false;
    }
    setRemindersEnabledState(enabled);
    await AsyncStorage.setItem('app.remindersEnabled', enabled.toString());
    return true;
  };

  const setReminderHour = async (hour) => {
    setReminderHourState(hour);
    await AsyncStorage.setItem('app.reminderHour', hour.toString());
  };

  const refreshKids = async () => {
    await loadKids(selectedKid?.id);
  };

  const value = {
    selectedKid,
    kids,
    language,
    isDarkMode,
    loading,
    selectKid,
    addKid,
    updateKid,
    deleteKid,
    changeLanguage,
    toggleDarkMode,
    refreshKids,
    remindersEnabled,
    reminderHour,
    setRemindersEnabled,
    setReminderHour,
    syncReminders,
    isArabic: language === 'ar',
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
