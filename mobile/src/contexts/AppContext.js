import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { kidsAPI } from '../services/api';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [selectedKid, setSelectedKid] = useState(null);
  const [kids, setKids] = useState([]);
  const [language, setLanguage] = useState('ar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppSettings();
  }, []);

  const loadAppSettings = async () => {
    try {
      const [savedLanguage, savedTheme, savedKidId] = await Promise.all([
        AsyncStorage.getItem('app.language'),
        AsyncStorage.getItem('app.darkMode'),
        AsyncStorage.getItem('app.selectedKidId'),
      ]);

      if (savedLanguage) setLanguage(savedLanguage);
      if (savedTheme) setIsDarkMode(savedTheme === 'true');
      if (savedKidId) {
        // Load selected kid from saved ID
        await loadKids(savedKidId);
      }
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
