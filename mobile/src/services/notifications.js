import { Platform, PermissionsAndroid } from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { memorizationAPI } from './api';
import {
  buildReminderSchedule,
  reminderMessage,
  REMINDER_DAYS_AHEAD,
} from '../utils/reminderSchedule';

/**
 * Review reminders are LOCAL notifications scheduled on the device from the
 * spaced-repetition due dates. No push server and no device tokens are
 * involved, so nothing about the child leaves the device for this feature.
 */

const CHANNEL_ID = 'review-reminders';
let configured = false;

export const configureNotifications = () => {
  if (configured) return;
  configured = true;

  PushNotification.configure({
    onNotification: (notification) => {
      if (Platform.OS === 'ios') {
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      }
    },
    popInitialNotification: true,
    // Must stay false: `true` makes the library register for remote (FCM)
    // push on Android, which crashes without a Firebase project.
    requestPermissions: false,
  });

  PushNotification.createChannel(
    {
      channelId: CHANNEL_ID,
      channelName: 'تذكيرات المراجعة',
      channelDescription: 'تذكير يومي بالآيات المستحقة للمراجعة',
      importance: 4,
      vibrate: true,
    },
    () => {}
  );
};

/** Asks the OS for permission to show notifications. Resolves to true if granted. */
export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'ios') {
      const result = await PushNotificationIOS.requestPermissions({
        alert: true,
        badge: true,
        sound: true,
      });
      return !!(result && result.alert);
    }

    // Android 13+ needs a runtime permission; older versions grant it at install.
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  } catch (error) {
    console.error('Notification permission error:', error);
    return false;
  }
};

export const cancelReviewReminders = () => {
  PushNotification.cancelAllLocalNotifications();
};

/**
 * Rebuilds every scheduled reminder from the server's due dates.
 * Call after anything that changes them: app start, a review, a new verse
 * memorized, a change of reminder settings, or a change to the kid list.
 *
 * If the due dates cannot be fetched (e.g. offline), the reminders already
 * scheduled are left in place rather than cleared.
 */
export const syncReviewReminders = async ({ kids, enabled, reminderHour }) => {
  configureNotifications();

  if (!enabled || !kids || kids.length === 0) {
    cancelReviewReminders();
    return { scheduled: 0 };
  }

  let plans;
  try {
    plans = await Promise.all(
      kids.map(async (kid) => {
        const res = await memorizationAPI.getUpcomingReviews(kid.id, REMINDER_DAYS_AHEAD);
        return {
          kid,
          schedule: buildReminderSchedule({
            now: new Date(),
            reminderHour,
            overdueCount: res.overdueCount || 0,
            upcoming: res.upcoming || [],
          }),
        };
      })
    );
  } catch (error) {
    console.error('Could not refresh review reminders:', error);
    return { scheduled: null };
  }

  cancelReviewReminders();

  let scheduled = 0;
  plans.forEach(({ kid, schedule }, kidIndex) => {
    schedule.forEach(({ date, count }, dayIndex) => {
      PushNotification.localNotificationSchedule({
        channelId: CHANNEL_ID,
        id: kidIndex * 100 + dayIndex + 1,
        title: 'حان وقت المراجعة 📖',
        message: reminderMessage(kid.name, count),
        date,
        allowWhileIdle: true,
        userInfo: { type: 'review_reminder', kidId: kid.id },
      });
      scheduled += 1;
    });
  });

  return { scheduled };
};
