import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioDownloader } from '../offline/audioDownloads';
import { getVerseAudioUrl } from '../utils/audio';

/**
 * Wires the download logic (src/offline/audioDownloads.js) to the real file
 * system, and keeps live progress so a screen opened mid-download can show it.
 *
 * Audio files are not personal data and are kept on logout.
 */

const downloader = createAudioDownloader({
  fs: {
    exists: (path) => RNFS.exists(path),
    // Downloaded audio can always be fetched again, so on iOS it is kept out
    // of iCloud backups (Apple's storage guidelines).
    mkdir: (path) =>
      RNFS.mkdir(path, Platform.OS === 'ios' ? { NSURLIsExcludedFromBackupKey: true } : undefined),
    unlink: (path) => RNFS.unlink(path),
    moveFile: (from, to) => RNFS.moveFile(from, to),
    stat: (path) => RNFS.stat(path),
    readDir: (path) => RNFS.readDir(path),
    downloadFile: ({ fromUrl, toFile }) => RNFS.downloadFile({ fromUrl, toFile }).promise,
  },
  storage: AsyncStorage,
  baseDir: `${RNFS.DocumentDirectoryPath}/recitations`,
  getVerseAudioUrl,
});

const progressByKey = new Map(); // `${reciter}:${surah}` → { done, total }
const listeners = new Set();
const keyOf = (reciter, surahNumber) => `${reciter}:${surahNumber}`;
const notify = () => listeners.forEach((listener) => listener());

export const subscribeToDownloads = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getDownloadProgress = (reciter, surahNumber) =>
  progressByKey.get(keyOf(reciter, surahNumber)) || null;

export const downloadSurahAudio = async ({ reciter, surahNumber, versesCount }) => {
  const key = keyOf(reciter, surahNumber);
  progressByKey.set(key, { done: 0, total: versesCount });
  notify();
  try {
    return await downloader.downloadSurah({
      reciter,
      surahNumber,
      versesCount,
      onProgress: (progress) => {
        progressByKey.set(key, progress);
        notify();
      },
    });
  } finally {
    progressByKey.delete(key);
    notify();
  }
};

export const cancelSurahAudioDownload = (reciter, surahNumber) =>
  downloader.cancelDownload(reciter, surahNumber);

export const deleteSurahAudio = async (reciter, surahNumber, versesCount) => {
  await downloader.deleteSurah(reciter, surahNumber, versesCount);
  notify();
};

export const deleteAllAudio = async () => {
  await downloader.deleteAll();
  notify();
};

export const {
  isSurahDownloaded,
  listDownloaded,
  getLocalVersePath,
  totalBytes,
} = downloader;

export { formatBytes, DownloadCancelledError } from '../offline/audioDownloads';
