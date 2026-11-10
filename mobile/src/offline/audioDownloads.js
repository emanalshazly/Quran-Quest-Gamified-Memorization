/**
 * Downloads per-verse recitation audio for offline listening.
 *
 * Pure logic: the file system, storage and URL builder are injected, so this
 * runs under plain jest. Files live at
 *   {baseDir}/{reciter}/{SSS}{AAA}.mp3
 * and an index in storage records which surahs are completely downloaded.
 * A surah only counts as downloaded once every one of its verse files is on
 * disk; each file is written to a temporary name first and renamed when it
 * has arrived in full, so an interrupted download never leaves a broken file
 * that would later be played.
 */

const INDEX_KEY = 'offline.audioIndex';
const DEFAULT_CONCURRENCY = 3;

const pad3 = (n) => String(n).padStart(3, '0');

export const verseFileName = (surahNumber, verseNumber) =>
  `${pad3(surahNumber)}${pad3(verseNumber)}.mp3`;

export const surahKey = (reciter, surahNumber) => `${reciter}:${surahNumber}`;

export class DownloadCancelledError extends Error {
  constructor() {
    super('Download cancelled');
    this.name = 'DownloadCancelledError';
  }
}

/**
 * @param {Object} deps
 * @param {Object} deps.fs  { exists, mkdir, unlink, moveFile, stat, readDir, downloadFile }
 *   downloadFile({ fromUrl, toFile }) → Promise<{ statusCode, bytesWritten }>
 * @param {{getItem: Function, setItem: Function}} deps.storage
 * @param {string} deps.baseDir
 * @param {(reciter, surahNumber, verseNumber) => string} deps.getVerseAudioUrl
 * @param {number} [deps.concurrency]
 */
export const createAudioDownloader = ({
  fs,
  storage,
  baseDir,
  getVerseAudioUrl,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const active = new Map(); // surahKey → { cancelled: boolean, promise }

  const reciterDir = (reciter) => `${baseDir}/${reciter}`;
  const versePath = (reciter, surahNumber, verseNumber) =>
    `${reciterDir(reciter)}/${verseFileName(surahNumber, verseNumber)}`;

  const loadIndex = async () => {
    try {
      const raw = await storage.getItem(INDEX_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const saveIndex = (index) => storage.setItem(INDEX_KEY, JSON.stringify(index));

  const updateIndex = async (mutate) => {
    const index = await loadIndex();
    mutate(index);
    await saveIndex(index);
  };

  const isSurahDownloaded = async (reciter, surahNumber) => {
    const index = await loadIndex();
    return !!index[surahKey(reciter, surahNumber)];
  };

  const listDownloaded = async () => {
    const index = await loadIndex();
    return Object.values(index);
  };

  /** Local path of a verse if its file is on disk, otherwise null. */
  const getLocalVersePath = async (reciter, surahNumber, verseNumber) => {
    const path = versePath(reciter, surahNumber, verseNumber);
    try {
      return (await fs.exists(path)) ? path : null;
    } catch (error) {
      return null;
    }
  };

  const downloadVerse = async (reciter, surahNumber, verseNumber, job) => {
    const finalPath = versePath(reciter, surahNumber, verseNumber);
    if (await fs.exists(finalPath)) {
      const { size } = await fs.stat(finalPath);
      return Number(size) || 0;
    }

    const tempPath = `${finalPath}.part`;
    if (await fs.exists(tempPath)) await fs.unlink(tempPath);

    let result;
    try {
      result = await fs.downloadFile({
        fromUrl: getVerseAudioUrl(reciter, surahNumber, verseNumber),
        toFile: tempPath,
      });
    } catch (error) {
      if (await fs.exists(tempPath)) await fs.unlink(tempPath);
      throw error;
    }

    const ok = result && result.statusCode >= 200 && result.statusCode < 300 && result.bytesWritten > 0;
    if (!ok || job.cancelled) {
      if (await fs.exists(tempPath)) await fs.unlink(tempPath);
      if (job.cancelled) throw new DownloadCancelledError();
      throw new Error(
        `Download failed for ${verseFileName(surahNumber, verseNumber)} (HTTP ${result?.statusCode})`
      );
    }

    await fs.moveFile(tempPath, finalPath);
    return result.bytesWritten;
  };

  /**
   * Downloads every verse of a surah for a reciter. Files already on disk
   * are kept, so a retry after a failure only fetches what is missing.
   * Concurrent calls for the same surah share one download.
   *
   * @param {Object} params
   * @param {string} params.reciter
   * @param {number} params.surahNumber
   * @param {number} params.versesCount
   * @param {(progress: {done: number, total: number}) => void} [params.onProgress]
   * @returns {Promise<{ bytes: number }>}
   */
  const downloadSurah = ({ reciter, surahNumber, versesCount, onProgress }) => {
    const key = surahKey(reciter, surahNumber);
    if (active.has(key)) return active.get(key).promise;

    const job = { cancelled: false };
    const run = async () => {
      if (!(await fs.exists(reciterDir(reciter)))) {
        await fs.mkdir(reciterDir(reciter));
      }

      const queue = Array.from({ length: versesCount }, (_, i) => i + 1);
      let done = 0;
      let bytes = 0;
      let failure = null;
      onProgress?.({ done, total: versesCount });

      const worker = async () => {
        while (queue.length > 0 && !failure && !job.cancelled) {
          const verseNumber = queue.shift();
          try {
            // Await first, then add: `bytes += await …` would read `bytes`
            // before the await and lose updates from the other workers.
            const verseBytes = await downloadVerse(reciter, surahNumber, verseNumber, job);
            bytes += verseBytes;
            done += 1;
            onProgress?.({ done, total: versesCount });
          } catch (error) {
            failure = failure || error;
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, versesCount) }, () => worker())
      );

      if (job.cancelled) throw new DownloadCancelledError();
      if (failure) throw failure;

      await updateIndex((index) => {
        index[key] = {
          reciter,
          surahNumber,
          versesCount,
          bytes,
          downloadedAt: new Date().toISOString(),
        };
      });
      return { bytes };
    };

    job.promise = run().finally(() => active.delete(key));
    active.set(key, job);
    return job.promise;
  };

  const isDownloading = (reciter, surahNumber) => active.has(surahKey(reciter, surahNumber));

  /** Stops an in-progress download. Files that finished stay for a later retry. */
  const cancelDownload = (reciter, surahNumber) => {
    const job = active.get(surahKey(reciter, surahNumber));
    if (job) job.cancelled = true;
  };

  const deleteSurah = async (reciter, surahNumber, versesCount) => {
    cancelDownload(reciter, surahNumber);
    for (let verse = 1; verse <= versesCount; verse += 1) {
      const path = versePath(reciter, surahNumber, verse);
      if (await fs.exists(path)) await fs.unlink(path);
      if (await fs.exists(`${path}.part`)) await fs.unlink(`${path}.part`);
    }
    await updateIndex((index) => {
      delete index[surahKey(reciter, surahNumber)];
    });
  };

  const deleteAll = async () => {
    active.forEach((job) => {
      job.cancelled = true;
    });
    if (await fs.exists(baseDir)) await fs.unlink(baseDir);
    await saveIndex({});
  };

  /** Total bytes of audio on disk, from the files themselves. */
  const totalBytes = async () => {
    if (!(await fs.exists(baseDir))) return 0;
    let total = 0;
    const reciters = await fs.readDir(baseDir);
    for (const entry of reciters) {
      if (!entry.isDirectory()) continue;
      const files = await fs.readDir(entry.path);
      files.forEach((file) => {
        if (file.isFile() && file.name.endsWith('.mp3')) total += Number(file.size) || 0;
      });
    }
    return total;
  };

  return {
    downloadSurah,
    cancelDownload,
    isDownloading,
    isSurahDownloaded,
    listDownloaded,
    getLocalVersePath,
    deleteSurah,
    deleteAll,
    totalBytes,
  };
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 ميجابايت';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} جيجابايت`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} ميجابايت`;
};
