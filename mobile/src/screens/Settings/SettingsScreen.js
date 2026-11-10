import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { RECITERS } from '../../constants';
import {
  listDownloaded,
  totalBytes,
  deleteAllAudio,
  formatBytes,
} from '../../services/audioDownloads';

const REMINDER_HOURS = [
  { hour: 7, label: '7 ص' },
  { hour: 13, label: '1 م' },
  { hour: 17, label: '5 م' },
  { hour: 20, label: '8 م' },
];

const SettingsScreen = ({ navigation }) => {
  const { logout, user } = useAuth();
  const { language, changeLanguage, isDarkMode, toggleDarkMode, selectedKid, updateKid,
    remindersEnabled, reminderHour, setRemindersEnabled, setReminderHour,
    isOnline, pendingSyncCount, syncNow } = useApp();

  const [audioStats, setAudioStats] = useState({ surahs: 0, bytes: 0 });

  const loadAudioStats = useCallback(async () => {
    try {
      const [entries, bytes] = await Promise.all([listDownloaded(), totalBytes()]);
      setAudioStats({ surahs: entries.length, bytes });
    } catch (error) {
      setAudioStats({ surahs: 0, bytes: 0 });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAudioStats();
    }, [loadAudioStats])
  );

  const confirmDeleteAllAudio = () => {
    Alert.alert(
      'حذف كل التلاوات المنزّلة',
      `سيُحذف ${formatBytes(audioStats.bytes)} من الجهاز. يمكنك تنزيلها مرة أخرى في أي وقت.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الكل',
          style: 'destructive',
          onPress: async () => {
            await deleteAllAudio();
            loadAudioStats();
          },
        },
      ]
    );
  };

  const toggleReminders = async (enabled) => {
    const ok = await setRemindersEnabled(enabled);
    if (!ok) {
      Alert.alert(
        'الإشعارات غير مفعّلة',
        'لم يُسمح للتطبيق بإرسال الإشعارات. يمكنك السماح بها من إعدادات الجهاز ثم المحاولة مجدداً.'
      );
    }
  };
  const currentReciter = selectedKid?.preferred_reciter || 'minshawi';

  const confirmLogout = () => {
    const message = pendingSyncCount > 0
      ? `لديك ${pendingSyncCount} إنجاز لم يُرسل بعد وسيُفقد عند الخروج. اتصل بالإنترنت أولاً لإرساله. هل تريد الخروج الآن؟`
      : 'هل تريد تسجيل الخروج؟';
    Alert.alert('تسجيل الخروج', message, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: logout },
    ]);
  };

  const Row = ({ icon, label, value, onPress, rightElement }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      {rightElement || <Text style={styles.rowValue}>{value} ›</Text>}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الحساب</Text>
        <Row icon="📧" label="البريد الإلكتروني" value={user?.email || ''} />
        <Row
          icon="🧒"
          label="ملفات الأطفال"
          value={selectedKid?.name || 'غير محدد'}
          onPress={() => navigation.navigate('KidProfiles')}
        />
        <Row
          icon="📊"
          label="لوحة الوالدين"
          value=""
          onPress={() => navigation.navigate('ParentDashboard')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التفضيلات</Text>
        <Row
          icon="🌐"
          label="اللغة"
          value={language === 'ar' ? 'العربية' : 'English'}
          onPress={() => changeLanguage(language === 'ar' ? 'en' : 'ar')}
        />
        <Row
          icon="🌙"
          label="الوضع الليلي"
          rightElement={
            <Switch
              value={isDarkMode}
              onValueChange={toggleDarkMode}
              trackColor={{ true: COLORS.primary }}
            />
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>التلاوات المنزّلة</Text>
        <Row
          icon="🎧"
          label="للاستماع دون اتصال"
          value={audioStats.surahs > 0 ? `${audioStats.surahs} سورة • ${formatBytes(audioStats.bytes)}` : 'لا شيء'}
        />
        {audioStats.surahs > 0 && (
          <Row icon="🗑️" label="حذف كل التلاوات المنزّلة" value="" onPress={confirmDeleteAllAudio} />
        )}
        <Text style={styles.subscriptionNote}>
          نزّل تلاوة أي سورة من صفحتها. التلاوات المنزّلة تبقى عند تسجيل الخروج.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>المزامنة</Text>
        <Row icon={isOnline ? '🟢' : '📴'} label="الحالة" value={isOnline ? 'متصل' : 'غير متصل'} />
        <Row
          icon="🔄"
          label="بانتظار الإرسال"
          value={pendingSyncCount > 0 ? `${pendingSyncCount} — أرسل الآن` : 'لا شيء'}
          onPress={pendingSyncCount > 0 && isOnline ? syncNow : undefined}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>تذكيرات المراجعة</Text>
        <Row
          icon="🔔"
          label="تذكير يومي بالآيات المستحقة"
          rightElement={
            <Switch
              value={remindersEnabled}
              onValueChange={toggleReminders}
              trackColor={{ true: COLORS.primary }}
            />
          }
        />
        {remindersEnabled && (
          <View style={styles.hoursRow}>
            {REMINDER_HOURS.map(({ hour, label }) => (
              <TouchableOpacity
                key={hour}
                style={[styles.hourChip, reminderHour === hour && styles.hourChipActive]}
                onPress={() => setReminderHour(hour)}
              >
                <Text style={[styles.hourChipText, reminderHour === hour && styles.hourChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <Text style={styles.subscriptionNote}>
          يصلك التذكير فقط في الأيام التي فيها آيات تحتاج مراجعة.
        </Text>
      </View>

      {selectedKid && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>القارئ المفضل لـ {selectedKid.name}</Text>
          {Object.values(RECITERS).map((reciter) => (
            <Row
              key={reciter.id}
              icon={currentReciter === reciter.id ? '🔊' : '🎧'}
              label={reciter.nameAr}
              value={currentReciter === reciter.id ? '✓' : ''}
              onPress={() => updateKid(selectedKid.id, { preferred_reciter: reciter.id })}
            />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الاشتراك</Text>
        <Row icon="⭐" label="الباقة الحالية" value="مجاني" />
        <Text style={styles.subscriptionNote}>
          الباقة الاحترافية (7$/شهر): جميع السور الثلاثين جزءاً{'\n'}
          الباقة العائلية (15$/شهر): حتى 5 أطفال + تقارير أسبوعية
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>

      <Text style={styles.attribution}>
        نص القرآن الكريم: مشروع تنزيل (Tanzil Project) — tanzil.net{'\n'}
        التلاوات الصوتية: everyayah.com
      </Text>
      <Text style={styles.version}>Quran Quest v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  section: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    marginBottom: 0,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIcon: {
    fontSize: FONT_SIZES.lg,
    marginRight: SPACING.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  rowValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  subscriptionNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingVertical: SPACING.sm,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  hoursRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  hourChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  hourChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  hourChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  hourChipTextActive: {
    color: COLORS.card,
    fontWeight: 'bold',
  },
  attribution: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  version: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
});

export default SettingsScreen;
