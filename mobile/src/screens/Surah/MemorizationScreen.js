import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import Sound from 'react-native-sound';
import { useApp } from '../../contexts/AppContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { RECITERS } from '../../constants';
import { getVerseAudioUrl } from '../../utils/audio';
import { getLocalVersePath } from '../../services/audioDownloads';

/**
 * Memorization Mode: one verse at a time, large Uthmani-style text,
 * reciter audio playback (when audio_url is available), repeat & next.
 */
const MemorizationScreen = ({ route, navigation }) => {
  const { surah, verses, startIndex = 0 } = route.params;
  const { selectedKid, isOnline } = useApp();
  const [index, setIndex] = useState(Math.min(startIndex, verses.length - 1));
  const [repeatCount, setRepeatCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [localPath, setLocalPath] = useState(null);
  const soundRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const verse = verses[index];
  const reciterId = selectedKid?.preferred_reciter || 'minshawi';
  const reciter = Object.values(RECITERS).find(r => r.id === reciterId) || RECITERS.MINSHAWI;
  const audioUrl = verse
    ? (surah.surah_number
        ? getVerseAudioUrl(reciterId, surah.surah_number, verse.verse_number)
        : verse.audio_url)
    : null;

  // Prefer a downloaded copy of this verse when there is one
  useEffect(() => {
    let cancelled = false;
    setLocalPath(null);
    if (verse && surah.surah_number) {
      getLocalVersePath(reciterId, surah.surah_number, verse.verse_number).then((path) => {
        if (!cancelled) setLocalPath(path);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [reciterId, surah.surah_number, verse?.verse_number]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.release();
      }
    };
  }, []);

  const animateVerseChange = (nextIndex) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setIndex(nextIndex);
    setRepeatCount(0);
  };

  const playAudio = () => {
    if (!localPath && !audioUrl) {
      Alert.alert('لا يوجد تسجيل', 'تلاوة هذه الآية غير متوفرة');
      return;
    }
    if (!localPath && !isOnline) {
      Alert.alert(
        'لا يوجد اتصال',
        'هذه التلاوة غير منزّلة على الجهاز. نزّلها من صفحة السورة لتستمع إليها دون اتصال.'
      );
      return;
    }

    if (soundRef.current) {
      soundRef.current.release();
      soundRef.current = null;
    }

    setPlaying(true);
    // react-native-sound: basePath '' for an absolute file path, null for a URL
    const sound = localPath
      ? new Sound(localPath, '', onLoaded)
      : new Sound(audioUrl, null, onLoaded);
    function onLoaded(error) {
      if (error) {
        setPlaying(false);
        Alert.alert('خطأ', 'تعذر تشغيل التلاوة');
        return;
      }
      sound.play(() => {
        setPlaying(false);
        sound.release();
        soundRef.current = null;
      });
    }
    soundRef.current = sound;
  };

  const handleRepeat = () => {
    setRepeatCount(c => c + 1);
    playAudio();
  };

  const handleNext = () => {
    if (index < verses.length - 1) {
      animateVerseChange(index + 1);
    } else {
      Alert.alert(
        'أحسنت! 🎉',
        `وصلت إلى نهاية سورة ${surah.name_ar}. جرّب وضع الاختبار لتثبيت الحفظ!`,
        [
          { text: 'وضع الاختبار', onPress: () => navigation.replace('Test', { surah, verses }) },
          { text: 'رجوع', onPress: () => navigation.goBack() },
        ]
      );
    }
  };

  const handlePrevious = () => {
    if (index > 0) animateVerseChange(index - 1);
  };

  if (!verse) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>لا توجد آيات متاحة لهذه السورة بعد</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress header */}
      <View style={styles.header}>
        <Text style={styles.surahName}>سورة {surah.name_ar}</Text>
        <Text style={styles.verseCounter}>
          الآية {verse.verse_number} من {surah.verses_count}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${((index + 1) / verses.length) * 100}%` }]}
          />
        </View>
      </View>

      {/* Verse display */}
      <Animated.View style={[styles.verseCard, { opacity: fadeAnim }]}>
        {verse.bismillah_prefix ? (
          <Text style={styles.bismillahText}>{verse.bismillah_prefix}</Text>
        ) : null}
        <Text style={styles.verseText}>{verse.text_ar}</Text>
        <Text style={styles.verseNumberBadge}>﴿ {verse.verse_number} ﴾</Text>
        {repeatCount > 0 && (
          <Text style={styles.repeatBadge}>🔁 كررتها {repeatCount} {repeatCount === 1 ? 'مرة' : 'مرات'}</Text>
        )}
      </Animated.View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.playButton, playing && styles.playButtonActive]}
          onPress={playAudio}
          disabled={playing}
        >
          <Text style={styles.playIcon}>{playing ? '🔊' : '▶️'}</Text>
          <Text style={styles.playText}>
            {playing ? 'جاري التشغيل...' : `استمع — ${reciter.nameAr}`}
          </Text>
        </TouchableOpacity>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
            onPress={handlePrevious}
            disabled={index === 0}
          >
            <Text style={styles.navButtonText}>السابقة ‹</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.repeatButton} onPress={handleRepeat}>
            <Text style={styles.repeatButtonText}>🔁 كرّر</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {index === verses.length - 1 ? 'إنهاء 🏁' : '› التالية'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.testLink}
          onPress={() => navigation.replace('Test', { surah, verses, startIndex: index })}
        >
          <Text style={styles.testLinkText}>🎤 أشعر أنني حفظتها — اختبرني!</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  header: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.secondary,
    marginVertical: SPACING.xs,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.secondary,
  },
  verseCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  verseText: {
    fontSize: 34,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 62,
    writingDirection: 'rtl',
  },
  bismillahText: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  verseNumberBadge: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    marginTop: SPACING.lg,
  },
  repeatBadge: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.secondaryDark,
    marginTop: SPACING.sm,
  },
  controls: {
    padding: SPACING.md,
  },
  playButton: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  playButtonActive: {
    opacity: 0.7,
  },
  playIcon: {
    fontSize: FONT_SIZES.xl,
  },
  playText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  navRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  repeatButton: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  repeatButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  nextButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  nextButtonText: {
    color: COLORS.card,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  testLink: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  testLinkText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default MemorizationScreen;
