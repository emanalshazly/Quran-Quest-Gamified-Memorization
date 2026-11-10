import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { useApp } from '../../contexts/AppContext';
import { memorizationAPI } from '../../services/api';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';

/**
 * Test Mode: the kid recites from memory, we record the audio and submit it.
 *
 * NOTE: on-device AI scoring (TensorFlow Lite) is NOT integrated yet.
 * Until it is, the score shown here is a PLACEHOLDER (clearly labelled in
 * the UI as "تقييم تجريبي") so the full flow — record → analyze → memorize →
 * points/badges — can be exercised end-to-end.
 */
const TestScreen = ({ route, navigation }) => {
  const { surah, verses, startIndex = 0, memorizedNumbers = [] } = route.params;
  const { selectedKid, syncReminders } = useApp();

  const [index, setIndex] = useState(Math.min(startIndex, verses.length - 1));
  const [showVerse, setShowVerse] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const recorderRef = useRef(new AudioRecorderPlayer());
  const audioPathRef = useRef(null);

  const verse = verses[index];
  const isAlreadyMemorized = verse && memorizedNumbers.includes(verse.verse_number);

  useEffect(() => {
    return () => {
      recorderRef.current.stopRecorder().catch(() => {});
      recorderRef.current.removeRecordBackListener();
    };
  }, []);

  const startRecording = async () => {
    try {
      setResult(null);
      const path = await recorderRef.current.startRecorder();
      audioPathRef.current = path;
      recorderRef.current.addRecordBackListener((e) => {
        setRecordSecs(Math.floor(e.currentPosition / 1000));
      });
      setRecording(true);
    } catch (error) {
      Alert.alert('خطأ', 'تعذر بدء التسجيل — تأكد من السماح باستخدام الميكروفون');
    }
  };

  const stopRecording = async () => {
    try {
      await recorderRef.current.stopRecorder();
      recorderRef.current.removeRecordBackListener();
      setRecording(false);
      await submitRecording();
    } catch (error) {
      setRecording(false);
      Alert.alert('خطأ', 'تعذر إيقاف التسجيل');
    }
  };

  const submitRecording = async () => {
    if (!selectedKid || !verse) return;
    setSubmitting(true);

    try {
      // 1) Save the recording metadata
      const recordRes = await memorizationAPI.recordRecitation({
        kid_id: selectedKid.id,
        verse_id: verse.id,
        audio_url: audioPathRef.current || 'local://recording',
        duration_seconds: recordSecs,
      });

      if (!recordRes.success) throw new Error('فشل حفظ التسجيل');

      // 2) PLACEHOLDER scoring until TFLite is integrated:
      //    a recitation of reasonable length gets a provisional passing score.
      const minExpectedSecs = Math.max(2, Math.floor(verse.text_ar.length / 25));
      const provisionalScore = recordSecs >= minExpectedSecs ? 85 : 55;

      const analyzeRes = await memorizationAPI.analyzeRecording({
        recording_id: recordRes.recording.id,
        accuracy_score: provisionalScore,
        tajweed_score: provisionalScore,
        pronunciation_score: provisionalScore,
        errors_detected: null,
      });

      let pointsEarned = 0;
      let badges = [];

      // 3) If passed and not yet memorized → mark memorized (points, streak, badges)
      if (analyzeRes.success && analyzeRes.isPassed && !isAlreadyMemorized) {
        const memorizeRes = await memorizationAPI.markAsMemorized({
          kid_id: selectedKid.id,
          verse_id: verse.id,
          recording_id: recordRes.recording.id,
          accuracy_score: provisionalScore,
        });
        if (memorizeRes.success) {
          pointsEarned = memorizeRes.pointsEarned || 0;
          syncReminders();
          badges = memorizeRes.badgesEarned || [];
        }
      }

      setResult({
        score: provisionalScore,
        isPassed: analyzeRes.isPassed,
        feedback: analyzeRes.recording?.feedback_ar,
        pointsEarned,
        badges,
      });
    } catch (error) {
      console.error('Submit recording error:', error);
      Alert.alert('خطأ', 'تعذر إرسال التسجيل، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
      setRecordSecs(0);
    }
  };

  const goNext = () => {
    setResult(null);
    setShowVerse(false);
    if (index < verses.length - 1) {
      setIndex(index + 1);
    } else {
      Alert.alert('ما شاء الله! 🏆', 'أنهيت اختبار السورة كاملة!', [
        { text: 'رجوع', onPress: () => navigation.goBack() },
      ]);
    }
  };

  if (!verse) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>لا توجد آيات متاحة لهذه السورة بعد</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.surahName}>🎤 اختبار سورة {surah.name_ar}</Text>
        <Text style={styles.verseCounter}>
          الآية {verse.verse_number} من {surah.verses_count}
          {isAlreadyMemorized ? ' • محفوظة ✓' : ''}
        </Text>
      </View>

      {/* Verse (hidden by default — it's a memory test!) */}
      <View style={styles.verseCard}>
        {showVerse ? (
          <>
            {verse.bismillah_prefix ? (
              <Text style={styles.bismillahText}>{verse.bismillah_prefix}</Text>
            ) : null}
            <Text style={styles.verseText}>{verse.text_ar}</Text>
          </>
        ) : (
          <Text style={styles.hiddenText}>🙈 الآية مخفية — اقرأها من ذاكرتك!</Text>
        )}
        <TouchableOpacity onPress={() => setShowVerse(!showVerse)}>
          <Text style={styles.toggleText}>
            {showVerse ? 'إخفاء الآية' : 'أظهر الآية (تلميح)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recording control */}
      {!result && (
        <View style={styles.recordSection}>
          {submitting ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.submittingText}>جاري التقييم...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.recordButton, recording && styles.recordButtonActive]}
              onPress={recording ? stopRecording : startRecording}
            >
              <Text style={styles.recordIcon}>{recording ? '⏹️' : '🎙️'}</Text>
              <Text style={styles.recordText}>
                {recording ? `إيقاف (${recordSecs} ث)` : 'ابدأ التسجيل'}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.placeholderNote}>
            التقييم الحالي تجريبي — سيُفعَّل التقييم الذكي بالذكاء الاصطناعي قريباً
          </Text>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={[styles.resultCard, result.isPassed ? styles.resultPass : styles.resultFail]}>
          <Text style={styles.resultScore}>{result.score}/100</Text>
          <Text style={styles.resultLabel}>تقييم تجريبي</Text>
          {result.feedback ? <Text style={styles.resultFeedback}>{result.feedback}</Text> : null}

          {result.pointsEarned > 0 && (
            <Text style={styles.resultPoints}>+{result.pointsEarned} نقطة 🎉</Text>
          )}
          {result.badges.map(badge => (
            <Text key={badge.id} style={styles.resultBadge}>
              {badge.badge_icon} شارة جديدة: {badge.description_ar}
            </Text>
          ))}

          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={() => setResult(null)}>
              <Text style={styles.retryButtonText}>🔁 حاول مجدداً</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={goNext}>
              <Text style={styles.nextButtonText}>
                {index === verses.length - 1 ? 'إنهاء 🏁' : 'الآية التالية ›'}
              </Text>
            </TouchableOpacity>
          </View>
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
  content: {
    paddingBottom: SPACING.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  header: {
    backgroundColor: COLORS.accent,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  surahName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  verseCounter: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryLight,
    marginTop: SPACING.xs,
  },
  verseCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  verseText: {
    fontSize: 28,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 52,
    writingDirection: 'rtl',
  },
  bismillahText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  hiddenText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  toggleText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.md,
    fontWeight: '600',
  },
  recordSection: {
    alignItems: 'center',
    margin: SPACING.md,
  },
  recordButton: {
    backgroundColor: COLORS.error,
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.large,
  },
  recordButtonActive: {
    backgroundColor: COLORS.primaryDark,
  },
  recordIcon: {
    fontSize: 44,
  },
  recordText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
  submittingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  placeholderNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  resultCard: {
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  resultPass: {
    borderColor: COLORS.success,
  },
  resultFail: {
    borderColor: COLORS.warning,
  },
  resultScore: {
    fontSize: FONT_SIZES.huge,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  resultLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  resultFeedback: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resultPoints: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.secondaryDark,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  resultBadge: {
    fontSize: FONT_SIZES.md,
    color: COLORS.accent,
    marginTop: SPACING.xs,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  nextButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
});

export default TestScreen;
