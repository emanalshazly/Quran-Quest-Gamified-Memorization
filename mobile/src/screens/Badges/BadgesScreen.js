import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { gamificationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const ALL_BADGES = [
  { name: 'first_verse', icon: '🌟', titleAr: 'الآية الأولى', descAr: 'حفظ أول آية' },
  { name: 'five_surahs', icon: '📖', titleAr: 'حافظ السور القصيرة', descAr: 'حفظ 5 سور كاملة' },
  { name: 'juz_master', icon: '🏆', titleAr: 'نجم الحفظ', descAr: 'حفظ جزء كامل' },
  { name: 'week_streak', icon: '🔥', titleAr: 'ملتزم ٧ أيام', descAr: 'استمرار 7 أيام متتالية' },
  { name: 'month_streak', icon: '⭐', titleAr: 'ملتزم شهر كامل', descAr: 'استمرار 30 يوماً' },
  { name: 'fifty_reviews', icon: '💪', titleAr: 'المُراجع الدؤوب', descAr: 'إكمال 50 مراجعة' },
  { name: 'perfect_ten', icon: '💯', titleAr: 'عشرة كاملة', descAr: '10 تقييمات مثالية متتالية' },
  { name: 'battle_champion', icon: '⚔️', titleAr: 'بطل المعارك', descAr: 'الفوز بـ 10 معارك' },
];

const BadgesScreen = () => {
  const { selectedKid } = useApp();
  const [earned, setEarned] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (selectedKid) loadBadges();
    }, [selectedKid])
  );

  const loadBadges = async () => {
    try {
      const res = await gamificationAPI.getBadges(selectedKid.id);
      if (res.success) setEarned(res.badges.map(b => b.badge_name));
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  };

  const renderBadge = ({ item }) => {
    const isEarned = earned.includes(item.name);
    return (
      <View style={[styles.badgeCard, !isEarned && styles.badgeLocked]}>
        <Text style={styles.badgeIcon}>{isEarned ? item.icon : '🔒'}</Text>
        <Text style={styles.badgeTitle}>{item.titleAr}</Text>
        <Text style={styles.badgeDesc}>{item.descAr}</Text>
        {isEarned && <Text style={styles.earnedMark}>✓ مكتسبة</Text>}
      </View>
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={ALL_BADGES}
      renderItem={renderBadge}
      keyExtractor={item => item.name}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.column}
      ListHeaderComponent={
        <Text style={styles.header}>
          🏅 {earned.length} من {ALL_BADGES.length} شارة
        </Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: SPACING.md,
  },
  column: {
    gap: SPACING.md,
  },
  header: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  badgeCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  badgeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  earnedMark: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryDark,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
});

export default BadgesScreen;
