import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { memorizationAPI } from '../../services/api';
import { submitReview as sendReview, pendingVerseIds } from '../../services/offline';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { MASTERY_LEVELS } from '../../constants';

/**
 * Daily Review: verses due today per the SM-2 spaced-repetition schedule.
 * Reviewing a verse awards points and reschedules its next review.
 */
const ReviewScreen = () => {
  const { selectedKid, remindersEnabled, setRemindersEnabled, syncReminders } = useApp();
  const [dueVerses, setDueVerses] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (selectedKid) loadData();
    }, [selectedKid])
  );

  const loadData = async () => {
    try {
      const [dueRes, statsRes, queuedVerseIds] = await Promise.all([
        memorizationAPI.getDueVerses(selectedKid.id),
        memorizationAPI.getStats(selectedKid.id),
        pendingVerseIds(selectedKid.id, 'review'),
      ]);
      // Verses already reviewed offline stay hidden until that review is synced
      if (dueRes.success) {
        setDueVerses((dueRes.verses || []).filter(v => !queuedVerseIds.includes(v.verse_id)));
      }
      if (statsRes.success) setStats(statsRes.stats);
    } catch (error) {
      console.error('Error loading review data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const submitReview = async (item, quality) => {
    // quality: 'good' → 90, 'hard' → 75, 'forgot' → 40
    const scoreMap = { good: 90, hard: 75, forgot: 40 };
    setReviewingId(item.id);

    try {
      const res = await sendReview({
        kid_id: selectedKid.id,
        verse_id: item.verse_id,
        accuracy_score: scoreMap[quality],
      });

      if (res.success) {
        setDueVerses(prev => prev.filter(v => v.id !== item.id));
        if (res.queued) {
          Alert.alert('حُفظت مراجعتك 📴', 'لا يوجد اتصال الآن — ستُرسل وتُحتسب نقاطها تلقائياً عند عودة الإنترنت');
          return;
        }
        syncReminders();
        if (quality !== 'forgot') {
          Alert.alert('أحسنت! ⭐', `+${res.pointsEarned} نقطة — المراجعة القادمة مجدولة تلقائياً`);
        }
      }
    } catch (error) {
      Alert.alert('خطأ', 'تعذر حفظ المراجعة');
    } finally {
      setReviewingId(null);
    }
  };

  const renderVerse = ({ item }) => {
    const verse = item.verses;
    const mastery = Object.values(MASTERY_LEVELS).find(m => m.id === item.mastery_level);
    const isBusy = reviewingId === item.id;

    return (
      <View style={styles.verseCard}>
        <View style={styles.verseHeader}>
          <Text style={styles.verseSurah}>
            {verse?.surahs?.name_ar} — آية {verse?.verse_number}
          </Text>
          <Text style={[styles.masteryChip, { color: mastery?.color || COLORS.textSecondary }]}>
            {mastery?.icon} {mastery?.nameAr}
          </Text>
        </View>

        <Text style={styles.verseText}>{verse?.text_ar}</Text>

        <Text style={styles.reviewPrompt}>اقرأها غيباً ثم قيّم نفسك:</Text>
        <View style={styles.reviewButtons}>
          <TouchableOpacity
            style={[styles.reviewButton, styles.goodButton]}
            onPress={() => submitReview(item, 'good')}
            disabled={isBusy}
          >
            <Text style={styles.reviewButtonText}>😊 أتقنتها</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reviewButton, styles.hardButton]}
            onPress={() => submitReview(item, 'hard')}
            disabled={isBusy}
          >
            <Text style={styles.reviewButtonText}>😅 بصعوبة</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reviewButton, styles.forgotButton]}
            onPress={() => submitReview(item, 'forgot')}
            disabled={isBusy}
          >
            <Text style={styles.reviewButtonText}>😔 نسيتها</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!selectedKid) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>اختر ملف طفل أولاً</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={dueVerses}
      renderItem={renderVerse}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
      }
      ListHeaderComponent={
        <>
        {!remindersEnabled && (
          <TouchableOpacity style={styles.reminderBanner} onPress={() => setRemindersEnabled(true)}>
            <Text style={styles.reminderBannerText}>
              🔔 فعّل التذكير اليومي حتى لا تفوتك مراجعة
            </Text>
          </TouchableOpacity>
        )}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{dueVerses.length}</Text>
              <Text style={styles.statLabel}>مستحقة اليوم</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.dueThisWeek}</Text>
              <Text style={styles.statLabel}>هذا الأسبوع</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.totalMemorized}</Text>
              <Text style={styles.statLabel}>إجمالي المحفوظ</Text>
            </View>
          </View>
        )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.emptyText}>
            لا توجد مراجعات مستحقة الآن — عمل رائع!
          </Text>
        </View>
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
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  doneEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  reminderBanner: {
    backgroundColor: COLORS.secondaryLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  reminderBannerText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.card,
    opacity: 0.8,
  },
  verseCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  verseSurah: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  masteryChip: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  verseText: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 42,
    marginBottom: SPACING.md,
  },
  reviewPrompt: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  reviewButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  goodButton: {
    backgroundColor: COLORS.success,
  },
  hardButton: {
    backgroundColor: COLORS.warning,
  },
  forgotButton: {
    backgroundColor: COLORS.error,
  },
  reviewButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
});

export default ReviewScreen;
