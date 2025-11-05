import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('supabase.auth.token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - logout user
      AsyncStorage.removeItem('supabase.auth.token');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password) => api.post('/auth/register', { email, password }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// Kids API
export const kidsAPI = {
  getAll: () => api.get('/kids'),
  getById: (kidId) => api.get(`/kids/${kidId}`),
  create: (kidData) => api.post('/kids', kidData),
  update: (kidId, kidData) => api.put(`/kids/${kidId}`, kidData),
  delete: (kidId) => api.delete(`/kids/${kidId}`),
  getStats: (kidId) => api.get(`/kids/${kidId}/stats`),
};

// Surahs API
export const surahsAPI = {
  getAll: () => api.get('/surahs'),
  getById: (surahId) => api.get(`/surahs/${surahId}`),
  getVerse: (surahId, verseNumber) => api.get(`/surahs/${surahId}/verses/${verseNumber}`),
  getProgress: (surahId, kidId) => api.get(`/surahs/${surahId}/progress/${kidId}`),
  getByJuz: (juzNumber) => api.get(`/surahs/juz/${juzNumber}`),
};

// Memorization API
export const memorizationAPI = {
  recordRecitation: (data) => api.post('/memorization/record', data),
  analyzeRecording: (data) => api.post('/memorization/analyze', data),
  markAsMemorized: (data) => api.post('/memorization/memorize', data),
  submitReview: (data) => api.post('/memorization/review', data),
  getDueVerses: (kidId) => api.get(`/memorization/due/${kidId}`),
  getStats: (kidId) => api.get(`/memorization/stats/${kidId}`),
  getHistory: (kidId) => api.get(`/memorization/history/${kidId}`),
};

// Gamification API
export const gamificationAPI = {
  getBadges: (kidId) => api.get(`/gamification/badges/${kidId}`),
  getLeaderboard: (type = 'global', limit = 10) =>
    api.get('/gamification/leaderboard', { params: { type, limit } }),
  getPointsHistory: (kidId, limit = 50) =>
    api.get(`/gamification/points-history/${kidId}`, { params: { limit } }),
  getDailyChallenge: (kidId) => api.get(`/gamification/daily-challenge/${kidId}`),
  updateChallengeProgress: (kidId, progressIncrement) =>
    api.post(`/gamification/daily-challenge/${kidId}/progress`, { progress_increment: progressIncrement }),
  getStats: (kidId) => api.get(`/gamification/stats/${kidId}`),
};

// Battle API
export const battleAPI = {
  createChallenge: (data) => api.post('/battle/challenge', data),
  acceptChallenge: (battleId) => api.post(`/battle/${battleId}/accept`),
  submitResult: (battleId, data) => api.post(`/battle/${battleId}/submit`, data),
  getPendingBattles: (kidId) => api.get(`/battle/pending/${kidId}`),
  getBattleHistory: (kidId) => api.get(`/battle/history/${kidId}`),
};

// Parent API
export const parentAPI = {
  getDashboard: () => api.get('/parent/dashboard'),
  getDetailedStats: (kidId) => api.get(`/parent/kid/${kidId}/detailed-stats`),
  createGoal: (data) => api.post('/parent/goal', data),
  getGoals: (kidId) => api.get(`/parent/goals/${kidId}`),
  updateGoal: (goalId, data) => api.put(`/parent/goal/${goalId}`, data),
  getWeeklyReport: () => api.get('/parent/weekly-report'),
};

// Notifications API
export const notificationsAPI = {
  getAll: (limit = 50, unreadOnly = false) =>
    api.get('/notifications', { params: { limit, unread_only: unreadOnly } }),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  schedule: (data) => api.post('/notifications/schedule', data),
};

export default api;
