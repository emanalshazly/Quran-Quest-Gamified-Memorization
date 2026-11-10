import React from 'react';
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

const SettingsScreen = ({ navigation }) => {
  const { logout, user } = useAuth();
  const { language, changeLanguage, isDarkMode, toggleDarkMode, selectedKid, updateKid } = useApp();
  const currentReciter = selectedKid?.preferred_reciter || 'minshawi';

  const confirmLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
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
