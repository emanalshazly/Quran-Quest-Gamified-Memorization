/**
 * Environment configuration.
 *
 * Replace these values for your environment. In production, inject them at
 * build time (e.g. react-native-config) instead of hard-coding.
 *
 * NOTE for local development on a real device/emulator:
 *  - Android emulator: use http://10.0.2.2:3000/api
 *  - iOS simulator:    use http://localhost:3000/api
 *  - Real device:      use your machine's LAN IP, e.g. http://192.168.1.10:3000/api
 */
import { Platform } from 'react-native';

const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api',
  ios: 'http://localhost:3000/api',
  default: 'http://localhost:3000/api',
});

export const API_BASE_URL = __DEV__ ? DEV_API_URL : 'https://api.your-production-domain.com/api';

export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
