import AsyncStorage from '@react-native-async-storage/async-storage';
import { memorizationAPI, responseCache } from './api';
import { createOfflineActions } from '../offline/actions';

// Wires the offline logic (src/offline) to the real storage and API client.
const actions = createOfflineActions({ storage: AsyncStorage, memorizationAPI });

export const { outbox, submitReview, submitTestResult, pendingVerseIds } = actions;

/** Removes everything stored for offline use (called on logout). */
export const clearOfflineData = async () => {
  await Promise.all([outbox.clear(), responseCache.clear()]);
};
