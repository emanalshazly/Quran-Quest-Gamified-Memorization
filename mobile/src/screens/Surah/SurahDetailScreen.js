import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../contexts/AppContext';
import { surahsAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

const SurahDetailScreen = ({ route, navigation }) => {
  const { surah: surahParam } = route.params;
  const { selectedKid, isArabic } = useApp();
  const [surah, setSurah] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [surahParam.id, selectedKid?.id])
  );

  const loadData = async () => {
    try {
      const [surahRes, progressRes] = await Promise.all([
        surahsAPI.getById(surahParam.id),
        selectedKid
          ? surahsAPI.getProgress(surahParam.id, selectedKid.id)
          : Promise.resolve(null),
      ]);

      if (surahRes.success) setSurah(surahRes.surah);
      if (progressRes?.success) setProgress(progressRes.progress);
    } catch (error) {
      console.error('Error loading surah:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!surah) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>تعذر تحميل السورة</Text>
      </View>
    );
  }

  const verses = surah.verses || [];
  const memorizedNumbers = progress?.memorizedVerses || [];
  const firstUnmemorizedIndex = verses.findIndex(
    v => !memorizedNumbers.includes(v.verse_number)
  );
  const startIndex = firstUnmemorizedIndex === -1 ? 0 : firstUnmemorizedIndex;

  return (
    <ScrollView style={styles.container}>
      {/* Surah info card */}
      <View style={styles.infoCard}>
        <Text style={styles.nameAr}>سورة {surah.name_ar}</Text>
        <Text style={styles.nameEn}>{surah.name_en}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{surah.verses_count} آية</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              {surah.revelation_type === 'makki' ? 'مكية 🕋' : 'مدنية 🕌'}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>الجزء {surah.juz_number}</Text>
          </View>
        </View>

        {(surah.virtue_ar || surah.virtue_en) && (
          <View style={styles.virtueBox}>
            <Text style={styles.virtueTitle}>✨ فضل السورة</Text>
            <Text style={styles.virtueText}>
              {isArabic ? surah.virtue_ar : surah.virtue_en}
            </Text>
          </View>
        )}

        {progress && (
          <View style={styles.progressBox}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress.progressPercentage}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.memorizedCount} / {progress.totalVerses} آية محفوظة
              {progress.isCompleted ? ' — أتممتها! 🏆' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Mode buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.modeButton, styles.memorizeButton]}
          onPress={() =>
            navigation.navigate('Memorization', {
              surah,
              verses,
              startIndex,
              memorizedNumbers,
            })
          }
          disabled={verses.length === 0}
        >
          <Text style={styles.modeIcon}>📖</Text>
          <Text style={styles.modeTitle}>وضع الحفظ</Text>
          <Text style={styles.modeSubtitle}>آية آية مع التلاوة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, styles.testButton]}
          onPress={() =>
            navigation.navigate('Test', {
              surah,
              verses,
              memorizedNumbers,
            })
          }
          disabled={verses.length === 0}
        >
          <Text style={styles.modeIcon}>🎤</Text>
          <Text style={styles.modeTitle}>وضع الاختبار</Text>
          <Text style={styles.modeSubtitle}>سجّل واحصل على تقييم</Text>
        </TouchableOpacity>
      </View>

      {verses.length === 0 && (
        <View style={styles.noVersesBox}>
          <Text style={styles.noVersesText}>
            آيات هذه السورة لم تُحمَّل في قاعدة البيانات بعد.
            {'\n'}شغّل database/seeds/002_quran_data.sql لتحميل نص القرآن.
          </Text>
        </View>
      )}

      {/* Verses preview */}
      {verses.length > 0 && (
        <View style={styles.versesSection}>
          <Text style={styles.versesTitle}>الآيات</Text>
          {verses.map(verse => {
            const isMemorized = memorizedNumbers.includes(verse.verse_number);
            return (
              <View
                key={verse.id}
                style={[styles.verseCard, isMemorized && styles.verseCardMemorized]}
              >
                {verse.bismillah_prefix ? (
                  <Text style={styles.bismillahText}>{verse.bismillah_prefix}</Text>
                ) : null}
                <Text style={styles.verseText}>
                  {verse.text_ar}{' '}
                  <Text style={styles.verseNumber}>﴿{verse.verse_number}﴾</Text>
                </Text>
                {isMemorized && <Text style={styles.verseCheck}>✓ محفوظة</Text>}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.error,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  nameAr: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  nameEn: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metaChip: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  metaChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  virtueBox: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    width: '100%',
    marginBottom: SPACING.md,
  },
  virtueTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.secondaryDark,
    marginBottom: SPACING.xs,
  },
  virtueText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  progressBox: {
    width: '100%',
  },
  progressBar: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },
  progressText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  modeButton: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  memorizeButton: {
    backgroundColor: COLORS.primary,
  },
  testButton: {
    backgroundColor: COLORS.accent,
  },
  modeIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  modeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  modeSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.card,
    opacity: 0.8,
  },
  noVersesBox: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  noVersesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  versesSection: {
    margin: SPACING.md,
  },
  versesTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  verseCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  verseCardMemorized: {
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  verseText: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 38,
  },
  bismillahText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  verseNumber: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
  verseCheck: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryDark,
    marginTop: SPACING.xs,
    fontWeight: 'bold',
  },
});

export default SurahDetailScreen;
