import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useApp } from '../../contexts/AppContext';
import { surahsAPI, gamificationAPI, memorizationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const HomeScreen = ({ navigation }) => {
  const { selectedKid, isArabic } = useApp();
  const [surahs, setSurahs] = useState([]);
  const [stats, setStats] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (selectedKid) {
      loadData();
    }
  }, [selectedKid]);

  const loadData = async () => {
    try {
      const [surahsRes, statsRes, challengeRes] = await Promise.all([
        surahsAPI.getAll(),
        gamificationAPI.getStats(selectedKid.id),
        gamificationAPI.getDailyChallenge(selectedKid.id),
      ]);

      if (surahsRes.success) setSurahs(surahsRes.surahs);
      if (statsRes.success) setStats(statsRes.stats);
      if (challengeRes.success) setDailyChallenge(challengeRes.challenge);
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

  const renderKidCard = () => (
    <View style={styles.kidCard}>
      <View style={styles.kidInfo}>
        <Text style={styles.kidName}>{selectedKid?.name}</Text>
        <Text style={styles.kidLevel}>المستوى {selectedKid?.level || 1}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.totalPoints || 0}</Text>
          <Text style={styles.statLabel}>نقطة</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.streakCount || 0}</Text>
          <Text style={styles.statLabel}>يوم متتالي</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.versesMemorized || 0}</Text>
          <Text style={styles.statLabel}>آية محفوظة</Text>
        </View>
      </View>

      {stats?.badgeCount > 0 && (
        <TouchableOpacity
          style={styles.badgesButton}
          onPress={() => navigation.navigate('Badges')}
        >
          <Text style={styles.badgesText}>
            🏆 {stats.badgeCount} شارة
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderDailyChallenge = () => {
    if (!dailyChallenge) return null;

    const progress = (dailyChallenge.current_progress / dailyChallenge.target_value) * 100;

    return (
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => navigation.navigate('DailyChallenge')}
      >
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeTitle}>التحدي اليومي</Text>
          <Text style={styles.challengePoints}>+{dailyChallenge.reward_points} نقطة</Text>
        </View>

        <Text style={styles.challengeDescription}>
          {isArabic ? dailyChallenge.challenge_description_ar : dailyChallenge.challenge_description_en}
        </Text>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {dailyChallenge.current_progress} / {dailyChallenge.target_value}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSurahItem = ({ item }) => {
    const isLocked = !item.is_free && selectedKid?.subscription_tier === 'free';

    return (
      <TouchableOpacity
        style={[styles.surahCard, isLocked && styles.surahCardLocked]}
        onPress={() => !isLocked && navigation.navigate('Surah', { surah: item })}
        disabled={isLocked}
      >
        <View style={styles.surahNumber}>
          <Text style={styles.surahNumberText}>{item.surah_number}</Text>
        </View>

        <View style={styles.surahInfo}>
          <Text style={styles.surahNameAr}>{item.name_ar}</Text>
          <Text style={styles.surahNameEn}>{item.name_en}</Text>
          <Text style={styles.surahMeta}>
            {item.verses_count} آية • {item.revelation_type === 'makki' ? 'مكية' : 'مدنية'}
          </Text>
        </View>

        {isLocked ? (
          <View style={styles.lockIcon}>
            <Text style={styles.lockIconText}>🔒</Text>
          </View>
        ) : (
          <Text style={styles.arrow}>›</Text>
        )}
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.emptyText}>الرجاء اختيار ملف طفل</Text>
        <TouchableOpacity
          style={styles.addKidButton}
          onPress={() => navigation.navigate('AddKid')}
        >
          <Text style={styles.addKidButtonText}>إضافة طفل</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderKidCard()}
        {renderDailyChallenge()}

        <View style={styles.surahsSection}>
          <Text style={styles.sectionTitle}>خريطة المغامرة</Text>
          <Text style={styles.sectionSubtitle}>اختر سورة لبدء الحفظ</Text>

          <FlatList
            data={surahs}
            renderItem={renderSurahItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.surahsList}
          />
        </View>
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
  kidCard: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
  },
  kidInfo: {
    marginBottom: SPACING.md,
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
  badgesButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.secondary,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  badgesText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  challengeCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
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
    color: COLORS.secondary,
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
  surahsList: {
    paddingBottom: SPACING.xl,
  },
  surahCard: {
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  surahCardLocked: {
    opacity: 0.5,
  },
  surahNumber: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  surahNumberText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  surahInfo: {
    flex: 1,
  },
  surahNameAr: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  surahNameEn: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  surahMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  lockIcon: {
    padding: SPACING.sm,
  },
  lockIconText: {
    fontSize: FONT_SIZES.lg,
  },
  arrow: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.textSecondary,
    padding: SPACING.sm,
  },
});

export default HomeScreen;
