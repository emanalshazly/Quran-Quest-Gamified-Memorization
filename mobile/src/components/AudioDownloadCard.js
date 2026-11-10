import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useApp } from '../contexts/AppContext';
import { RECITERS } from '../constants';
import {
  downloadSurahAudio,
  cancelSurahAudioDownload,
  deleteSurahAudio,
  isSurahDownloaded,
  getDownloadProgress,
  subscribeToDownloads,
  listDownloaded,
  formatBytes,
  DownloadCancelledError,
} from '../services/audioDownloads';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/theme';

/**
 * Download / delete control for one surah's recitation, for the kid's
 * preferred reciter.
 */
const AudioDownloadCard = ({ surah }) => {
  const { selectedKid, isOnline } = useApp();
  const reciterId = selectedKid?.preferred_reciter || 'minshawi';
  const reciter = Object.values(RECITERS).find((r) => r.id === reciterId) || RECITERS.MINSHAWI;

  const [downloaded, setDownloaded] = useState(false);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [progress, setProgress] = useState(() =>
    getDownloadProgress(reciterId, surah.surah_number)
  );

  const refresh = useCallback(async () => {
    setProgress(getDownloadProgress(reciterId, surah.surah_number));
    const isDone = await isSurahDownloaded(reciterId, surah.surah_number);
    setDownloaded(isDone);
    if (isDone) {
      const entry = (await listDownloaded()).find(
        (e) => e.reciter === reciterId && e.surahNumber === surah.surah_number
      );
      setSizeBytes(entry?.bytes || 0);
    }
  }, [reciterId, surah.surah_number]);

  useEffect(() => {
    refresh();
    return subscribeToDownloads(refresh);
  }, [refresh]);

  const startDownload = async () => {
    try {
      await downloadSurahAudio({
        reciter: reciterId,
        surahNumber: surah.surah_number,
        versesCount: surah.verses_count,
      });
    } catch (error) {
      if (error instanceof DownloadCancelledError) return;
      Alert.alert(
        'لم يكتمل التنزيل',
        'تعذّر تنزيل بعض الآيات. اضغط "تنزيل" مرة أخرى لإكمال الآيات الناقصة فقط.'
      );
    }
  };

  const confirmDownload = async () => {
    if (!isOnline) {
      Alert.alert('لا يوجد اتصال', 'اتصل بالإنترنت لتنزيل التلاوة.');
      return;
    }
    const state = await NetInfo.fetch();
    if (state.type === 'cellular') {
      Alert.alert(
        'تنزيل عبر بيانات الجوال',
        'أنت متصل عبر بيانات الجوال. قد يستهلك التنزيل جزءاً من باقتك، خاصة للسور الطويلة. هل تريد المتابعة؟',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'نزّل', onPress: startDownload },
        ]
      );
      return;
    }
    startDownload();
  };

  const confirmDelete = () => {
    Alert.alert('حذف التلاوة المنزّلة', `حذف تلاوة سورة ${surah.name_ar} من الجهاز؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => deleteSurahAudio(reciterId, surah.surah_number, surah.verses_count),
      },
    ]);
  };

  if (progress) {
    const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <View style={styles.card}>
        <Text style={styles.title}>⬇️ جاري تنزيل التلاوة — {reciter.nameAr}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
        <View style={styles.row}>
          <Text style={styles.meta}>
            {progress.done} / {progress.total} آية
          </Text>
          <TouchableOpacity onPress={() => cancelSurahAudioDownload(reciterId, surah.surah_number)}>
            <Text style={styles.cancel}>إيقاف</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (downloaded) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.title}>✅ التلاوة متاحة دون اتصال</Text>
            <Text style={styles.meta}>
              {reciter.nameAr} • {formatBytes(sizeBytes)}
            </Text>
          </View>
          <TouchableOpacity onPress={confirmDelete}>
            <Text style={styles.delete}>حذف</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={confirmDownload}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.title}>⬇️ تنزيل التلاوة للاستماع دون اتصال</Text>
          <Text style={styles.meta}>
            {reciter.nameAr} • {surah.verses_count} آية
          </Text>
        </View>
        <Text style={styles.action}>تنزيل</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  meta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  action: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  delete: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
  },
  cancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.round,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
});

export default AudioDownloadCard;
