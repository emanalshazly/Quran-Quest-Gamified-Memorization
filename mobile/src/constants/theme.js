// Theme colors - Islamic inspired palette
export const COLORS = {
  // Primary colors
  primary: '#2E7D32', // Islamic green
  primaryDark: '#1B5E20',
  primaryLight: '#4CAF50',

  // Secondary colors
  secondary: '#FFD700', // Gold
  secondaryDark: '#FFA000',
  secondaryLight: '#FFE082',

  // Accent colors
  accent: '#0D47A1', // Deep blue
  accentLight: '#42A5F5',

  // Backgrounds
  background: '#F5F5F5',
  backgroundDark: '#1E1E1E',
  card: '#FFFFFF',
  cardDark: '#2C2C2C',

  // Text colors
  text: '#212121',
  textSecondary: '#757575',
  textDark: '#FFFFFF',
  textSecondaryDark: '#BDBDBD',

  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Gamification colors
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',

  // UI elements
  border: '#E0E0E0',
  borderDark: '#424242',
  shadow: 'rgba(0, 0, 0, 0.1)',

  // Transparent
  transparent: 'transparent',
};

// Spacing system
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Font sizes
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

// Font families
export const FONTS = {
  regular: 'Tajawal-Regular',
  medium: 'Tajawal-Medium',
  bold: 'Tajawal-Bold',
  arabic: 'Amiri-Regular', // For Quranic text
  arabicBold: 'Amiri-Bold',
};

// Border radius
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

// Shadow styles
export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Animation durations
export const ANIMATION = {
  fast: 200,
  normal: 300,
  slow: 500,
};

export default {
  COLORS,
  SPACING,
  FONT_SIZES,
  FONTS,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
};
