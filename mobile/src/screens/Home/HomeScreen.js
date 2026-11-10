import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { surahsAPI, gamificationAPI, memorizationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { JUZ_NAMES } from '../../constants';

const HomeScreen = ({ navigation }) => {
  const { selectedKid, isArabic, isOnline, pendingSyncCount } = useApp();
  const [surahs, setSurahs] = useState([]);
  const [subscriptionTier, setSubscriptionTier] = useState('free');
  const [progressBySurah, setProgressBySurah] = useState({});
  const [stats, setStats] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (selectedKid) {
        loadData();
      } else {
        setLoading(false);
      }
    }, [selectedKid])
  );

  const loadData = async () => {
    try {
      const [surahsRes, statsRes, challengeRes, progressRes] = await Promise.all([
        surahsAPI.getAll(),
        gamificationAPI.getStats(selectedKid.id),
        gamificationAPI.getDailyChallenge(selectedKid.id),
        memorizationAPI.getProgressMap(selectedKid.id),
      ]);

      if (surahsRes.success) {
        setSurahs(surahsRes.surahs);
        setSubscriptionTier(surahsRes.subscriptionTier || 'free');
      }
      if (statsRes.success) setStats(statsRes.stats);
      if (challengeRes.success) setDailyChallenge(challengeRes.challenge);
      if (progressRes.success) setProgressBySurah(progressRes.progressBySurah || {});
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---- Quest Map helpers --------------------------------------------------

  const getSurahState = (surah, currentSurahId) => {
    const memorizedCount = progressBySurah[surah.id] || 0;
    if (memorizedCount >= surah.verses_count) return 'memorized';
    if (!surah.is_free && subscriptionTier === 'free') return 'locked';
    if (surah.id === currentSurahId) return 'current';
    return 'available';
  };

  // The "current" surah = first unlocked, not-yet-completed surah with any
  // progress; otherwise the first unlocked incomplete surah.
  const findCurrentSurahId = (list) => {
    const unlocked = list.filter(s => s.is_free || subscriptionTier !== 'free');
    const inProgress = unlocked.find(
      s => (progressBySurah[s.id] || 0) > 0 && (progressBySurah[s.id] || 0) < s.verses_count
    );
    if (inProgress) return inProgress.id;
    const next = unlocked.find(s => (progressBySurah[s.id] || 0) < s.verses_count);
    return next?.id;
  };

  const groupByJuz = (list) => {
    const groups = {};
    list.forEach(s => {
      const juz = s.juz_number || 0;
      if (!groups[juz]) groups[juz] = [];
      groups[juz].push(s);
    });
    return Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a)) // Juz 30 (short surahs) first
      .map(juz => ({ juz: Number(juz), surahs: groups[juz] }));
  };

  // ---- Renderers ----------------------------------------------------------

  const renderKidCard = () => (
    <TouchableOpacity style={styles.kidCard} onPress={() => navigation.navigate('KidProfiles')}>
      <View style={styles.kidHeader}>
        <Text style={styles.kidAvatar}>
          {selectedKid?.avatar?.length <= 4 ? selectedKid.avatar : '🧒'}
        </Text>
        <View style={styles.kidInfo}>
          <Text style={styles.kidName}>{selectedKid?.name}</Text>
          <Text style={styles.kidLevel}>المستوى {stats?.level || selectedKid?.level || 1}</Text>
        </View>
        <Text style={styles.switchKid}>تبديل ⇄</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.totalPoints || 0}</Text>
          <Text style={styles.statLabel}>نقطة</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>🔥 {stats?.streakCount || 0}</Text>
          <Text style={styles.statLabel}>يوم متتالي</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.versesMemorized || 0}</Text>
          <Text style={styles.statLabel}>آية محفوظة</Text>
        </View>
      </View>

      {stats?.badges?.length > 0 && (
        <TouchableOpacity
          style={styles.badgesRow}
          onPress={() => navigation.navigate('Badges')}
        >
          {stats.badges.slice(0, 3).map((badge) => (
            <Text key={badge.id} style={styles.badgeIcon}>{badge.badge_icon}</Text>
          ))}
          <Text style={styles.badgesText}>
            {stats.badges.length} شارة — اعرض الكل ›
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderDailyChallenge = () => {
    if (!dailyChallenge) return null;
    const progress = Math.min(
      100,
      (dailyChallenge.current_progress / dailyChallenge.target_value) * 100
    );

    return (
      <View style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeTitle}>⚡ التحدي اليومي</Text>
          <Text style={styles.challengePoints}>+{dailyChallenge.reward_points} نقطة</Text>
        </View>
        <Text style={styles.challengeDescription}>
          {isArabic
            ? dailyChallenge.challenge_description_ar
            : dailyChallenge.challenge_description_en}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {dailyChallenge.current_progress} / {dailyChallenge.target_value}
          </Text>
        </View>
      </View>
    );
  };

  const renderSurahNode = (surah, state) => {
    const memorizedCount = progressBySurah[surah.id] || 0;
    const isLocked = state === 'locked';

    return (
      <TouchableOpacity
        key={surah.id}
        style={[
          styles.surahNode,
          state === 'memorized' && styles.surahNodeMemorized,
          state === 'current' && styles.surahNodeCurrent,
          isLocked && styles.surahNodeLocked,
        ]}
        onPress={() => !isLocked && navigation.navigate('Surah', { surah })}
        disabled={isLocked}
      >
        <View
          style={[
            styles.surahCircle,
            state === 'memorized' && styles.circleMemorized,
            state === 'current' && styles.circleCurrent,
            isLocked && styles.circleLocked,
          ]}
        >
          <Text style={styles.surahCircleText}>
            {state === 'memorized' ? '✓' : isLocked ? '🔒' : surah.surah_number}
          </Text>
        </View>
        <View style={styles.surahNodeInfo}>
          <Text style={[styles.surahNodeName, isLocked && styles.textLocked]}>
            {isArabic ? surah.name_ar : surah.name_en}
          </Text>
          <Text style={styles.surahNodeMeta}>
            {memorizedCount}/{surah.verses_count} آية
            {state === 'current' ? '  ⭐ استمر هنا' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuestMap = () => {
    const currentSurahId = findCurrentSurahId(surahs);
    const worlds = groupByJuz(surahs);

    return (
      <View style={styles.surahsSection}>
        <Text style={styles.sectionTitle}>🗺️ خريطة المغامرة</Text>
        <Text style={styles.sectionSubtitle}>كل جزء عالم، وكل سورة مرحلة</Text>

        {worlds.map(({ juz, surahs: juzSurahs }) => (
          <View key={juz} style={styles.worldCard}>
            <Text style={styles.worldTitle}>
              🌍 {JUZ_NAMES[juz] || `الجزء ${juz}`}
            </Text>
            {juzSurahs.map(surah =>
              renderSurahNode(surah, getSurahState(surah, currentSurahId))
            )}
          </View>
        ))}

        {subscriptionTier === 'free' && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeText}>
              🔓 اشترك في الباقة الاحترافية لفتح جميع السور الثلاثين جزءاً
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ---- Screen states ------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (!selectedKid) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>الرجاء اختيار ملف طفل للبدء 🌟</Text>
        <TouchableOpacity
          style={styles.addKidButton}
          onPress={() => navigation.navigate('KidProfiles')}
        >
          <Text style={styles.addKidButtonText}>ملفات الأطفال</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {(!isOnline || pendingSyncCount > 0) && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              {!isOnline
                ? '📴 أنت غير متصل — يمكنك متابعة الحفظ والمراجعة'
                : '🔄 جاري إرسال ما أنجزته دون اتصال'}
              {pendingSyncCount > 0 ? ` (${pendingSyncCount} بانتظار الإرسال)` : ''}
            </Text>
          </View>
        )}
        {renderKidCard()}
        {renderDailyChallenge()}
        {renderQuestMap()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  addKidButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  addKidButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  offlineBanner: {
    backgroundColor: COLORS.warning,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  offlineBannerText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  kidCard: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
  },
  kidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  kidAvatar: {
    fontSize: 40,
    marginRight: SPACING.md,
  },
  kidInfo: {
    flex: 1,
  },
  kidName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  kidLevel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.secondary,
  },
  switchKid: {
    color: COLORS.card,
    fontSize: FONT_SIZES.sm,
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.card,
    opacity: 0.8,
  },
  badgesRow: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.secondary,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  badgeIcon: {
    fontSize: FONT_SIZES.lg,
  },
  badgesText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  challengeCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  challengeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  challengePoints: {
    fontSize: FONT_SIZES.md,
    color: COLORS.secondaryDark,
    fontWeight: 'bold',
  },
  challengeDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  surahsSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  worldCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  worldTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: SPACING.sm,
  },
  surahNode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  surahNodeMemorized: {},
  surahNodeCurrent: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.secondary,
    paddingHorizontal: SPACING.sm,
    ...SHADOWS.small,
  },
  surahNodeLocked: {
    opacity: 0.45,
  },
  surahCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  circleMemorized: {
    backgroundColor: COLORS.gold,
  },
  circleCurrent: {
    backgroundColor: COLORS.secondaryDark,
  },
  circleLocked: {
    backgroundColor: COLORS.border,
  },
  surahCircleText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  surahNodeInfo: {
    flex: 1,
  },
  surahNodeName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  textLocked: {
    color: COLORS.textSecondary,
  },
  surahNodeMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  upgradeCard: {
    backgroundColor: COLORS.accentLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  upgradeText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default HomeScreen;
