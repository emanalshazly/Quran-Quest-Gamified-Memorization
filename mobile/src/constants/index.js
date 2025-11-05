export const RECITERS = {
  MINSHAWI: {
    id: 'minshawi',
    nameAr: 'محمد صديق المنشاوي',
    nameEn: 'Muhammad Siddiq Al-Minshawi',
  },
  ABDULBASIT: {
    id: 'abdulbasit',
    nameAr: 'عبد الباسط عبد الصمد',
    nameEn: 'Abdul Basit Abdul Samad',
  },
  MAHER: {
    id: 'maher',
    nameAr: 'ماهر المعيقلي',
    nameEn: 'Maher Al-Muaiqly',
  },
};

export const AVATARS = [
  'avatar_boy_1.png',
  'avatar_boy_2.png',
  'avatar_boy_3.png',
  'avatar_girl_1.png',
  'avatar_girl_2.png',
  'avatar_girl_3.png',
];

export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    maxKids: 1,
    maxSurahs: 3,
    features: ['3 surahs', '1 kid profile', 'Basic features'],
  },
  PRO: {
    id: 'pro',
    nameAr: 'احترافي',
    nameEn: 'Pro',
    price: 7,
    currency: 'USD',
    maxKids: 3,
    maxSurahs: 114,
    features: ['All 30 Juz', 'Up to 3 kids', 'Advanced analytics', 'All reciters'],
  },
  FAMILY: {
    id: 'family',
    nameAr: 'عائلي',
    nameEn: 'Family',
    price: 15,
    currency: 'USD',
    maxKids: 5,
    maxSurahs: 114,
    features: ['All 30 Juz', 'Up to 5 kids', 'Advanced analytics', 'All reciters', 'Weekly reports'],
  },
};

export const BADGE_ICONS = {
  FIRST_VERSE: '🌟',
  FIVE_SURAHS: '📖',
  JUZ_MASTER: '🏆',
  WEEK_STREAK: '🔥',
  MONTH_STREAK: '⭐',
  FIFTY_REVIEWS: '💪',
  PERFECT_TEN: '💯',
  BATTLE_CHAMPION: '⚔️',
};

export const MASTERY_LEVELS = {
  BEGINNER: {
    id: 'beginner',
    nameAr: 'مبتدئ',
    nameEn: 'Beginner',
    color: '#FF9800',
    icon: '🌱',
  },
  INTERMEDIATE: {
    id: 'intermediate',
    nameAr: 'متوسط',
    nameEn: 'Intermediate',
    color: '#2196F3',
    icon: '🌿',
  },
  ADVANCED: {
    id: 'advanced',
    nameAr: 'متقدم',
    nameEn: 'Advanced',
    color: '#9C27B0',
    icon: '🌳',
  },
  MASTER: {
    id: 'master',
    nameAr: 'متقن',
    nameEn: 'Master',
    color: '#FFD700',
    icon: '👑',
  },
};

export const CHALLENGE_TYPES = {
  MEMORIZE_VERSES: 'memorize_verses',
  REVIEW_VERSES: 'review_verses',
  RECORD_RECITATIONS: 'record_recitations',
  PERFECT_SCORES: 'perfect_scores',
};

export const POINTS_CONFIG = {
  VERSE_MEMORIZED: 10,
  VERSE_REVIEWED: 5,
  DAILY_STREAK: 20,
  CHALLENGE_COMPLETED: 50,
  BATTLE_WON: 30,
  PERFECT_SCORE: 15,
  SURAH_COMPLETED: 100,
};

export const ACCURACY_THRESHOLDS = {
  EXCELLENT: 95,
  VERY_GOOD: 85,
  GOOD: 70,
  NEEDS_IMPROVEMENT: 50,
};

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1500, 2000, 3000, 4000, 5000, // Levels 1-10
  6500, 8000, 10000, 12500, 15000, 18000, 21000, 25000, 30000, 35000, // Levels 11-20
];

export const JUZ_NAMES = {
  30: 'جزء عم',
  29: 'جزء تبارك',
  28: 'جزء قد سمع',
  // Add more juz names as needed
};

export default {
  RECITERS,
  AVATARS,
  SUBSCRIPTION_TIERS,
  BADGE_ICONS,
  MASTERY_LEVELS,
  CHALLENGE_TYPES,
  POINTS_CONFIG,
  ACCURACY_THRESHOLDS,
  LEVEL_THRESHOLDS,
  JUZ_NAMES,
};
