import {
  createAudioDownloader,
  DownloadCancelledError,
  formatBytes,
  verseFileName,
} from '../src/offline/audioDownloads';

const createMemoryStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: async (key) => (data.has(key) ? data.get(key) : null),
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
};

/**
 * In-memory file system with the subset of the react-native-fs API the
 * downloader uses. `serve` decides each download's outcome.
 */
const createFakeFs = (serve = () => ({ statusCode: 200, bytes: 1000 })) => {
  const files = new Map(); // path → size
  const dirs = new Set();
  const requested = [];

  const fs = {
    files,
    dirs,
    requested,
    serve,
    exists: async (path) => files.has(path) || dirs.has(path),
    // Like react-native-fs, mkdir also creates missing parent folders
    mkdir: async (path) => {
      const parts = path.split('/');
      for (let i = 2; i <= parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
    },
    unlink: async (path) => {
      files.delete(path);
      dirs.delete(path);
      [...files.keys()].filter((p) => p.startsWith(`${path}/`)).forEach((p) => files.delete(p));
      [...dirs].filter((p) => p.startsWith(`${path}/`)).forEach((p) => dirs.delete(p));
    },
    moveFile: async (from, to) => {
      files.set(to, files.get(from));
      files.delete(from);
    },
    stat: async (path) => ({ size: files.get(path) }),
    readDir: async (path) => {
      const prefix = `${path}/`;
      const children = new Map();
      [...dirs]
        .filter((d) => d.startsWith(prefix) && !d.slice(prefix.length).includes('/'))
        .forEach((d) => children.set(d, { path: d, name: d.slice(prefix.length), isDirectory: () => true, isFile: () => false }));
      [...files.entries()]
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .forEach(([p, size]) =>
          children.set(p, { path: p, name: p.slice(prefix.length), size, isDirectory: () => false, isFile: () => true })
        );
      return [...children.values()];
    },
    downloadFile: async ({ fromUrl, toFile }) => {
      requested.push(fromUrl);
      await new Promise((resolve) => setTimeout(resolve, 1));
      const outcome = fs.serve(fromUrl);
      if (outcome instanceof Error) throw outcome;
      if (outcome.bytes > 0) files.set(toFile, outcome.bytes);
      return { statusCode: outcome.statusCode, bytesWritten: outcome.bytes };
    },
  };
  return fs;
};

const BASE = '/docs/recitations';
const urlFor = (reciter, s, a) => `https://audio.test/${reciter}/${verseFileName(s, a)}`;

const setup = (serve, options = {}) => {
  const fs = createFakeFs(serve);
  const storage = createMemoryStorage();
  const downloader = createAudioDownloader({
    fs,
    storage,
    baseDir: BASE,
    getVerseAudioUrl: urlFor,
    ...options,
  });
  return { fs, storage, downloader };
};

describe('downloadSurah', () => {
  test('downloads every verse, records the surah, and reports progress', async () => {
    const { fs, downloader } = setup();
    const progress = [];

    const result = await downloader.downloadSurah({
      reciter: 'minshawi',
      surahNumber: 112,
      versesCount: 4,
      onProgress: (p) => progress.push(p.done),
    });

    expect(result.bytes).toBe(4000);
    expect(fs.files.has(`${BASE}/minshawi/112001.mp3`)).toBe(true);
    expect(fs.files.has(`${BASE}/minshawi/112004.mp3`)).toBe(true);
    expect([...fs.files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(4);
    expect(await downloader.isSurahDownloaded('minshawi', 112)).toBe(true);
    expect(await downloader.isSurahDownloaded('maher', 112)).toBe(false);
  });

  test('local paths are returned only for files on disk', async () => {
    const { downloader } = setup();
    expect(await downloader.getLocalVersePath('minshawi', 112, 1)).toBeNull();

    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 });
    expect(await downloader.getLocalVersePath('minshawi', 112, 1)).toBe(`${BASE}/minshawi/112001.mp3`);
    expect(await downloader.getLocalVersePath('abdulbasit', 112, 1)).toBeNull();
  });

  test('a failed verse fails the surah, leaves no partial file, and is not recorded', async () => {
    const { fs, downloader } = setup((url) =>
      url.endsWith('112003.mp3') ? { statusCode: 404, bytes: 0 } : { statusCode: 200, bytes: 1000 }
    );

    await expect(
      downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 })
    ).rejects.toThrow('HTTP 404');

    expect(await downloader.isSurahDownloaded('minshawi', 112)).toBe(false);
    expect(fs.files.has(`${BASE}/minshawi/112003.mp3`)).toBe(false);
    expect([...fs.files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  });

  test('an error page with a 200 status but no bytes is not saved as audio', async () => {
    const { fs, downloader } = setup(() => ({ statusCode: 200, bytes: 0 }));
    await expect(
      downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 1 })
    ).rejects.toThrow();
    expect(fs.files.size).toBe(0);
  });

  test('a network error cleans up the temporary file', async () => {
    const { fs, downloader } = setup((url) => {
      if (url.endsWith('112002.mp3')) return new Error('Network request failed');
      return { statusCode: 200, bytes: 1000 };
    });
    await expect(
      downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 })
    ).rejects.toThrow('Network request failed');
    expect([...fs.files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  });

  test('a retry only fetches the verses that are still missing', async () => {
    let failVerse3 = true;
    const { fs, downloader } = setup((url) => {
      if (failVerse3 && url.endsWith('112003.mp3')) return new Error('Network request failed');
      return { statusCode: 200, bytes: 1000 };
    }, { concurrency: 1 });

    await expect(
      downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 })
    ).rejects.toThrow();
    const firstAttempt = fs.requested.length;

    failVerse3 = false;
    const result = await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 });
    const retried = fs.requested.slice(firstAttempt);

    expect(retried).toEqual([urlFor('minshawi', 112, 3), urlFor('minshawi', 112, 4)]);
    expect(result.bytes).toBe(4000);
    expect(await downloader.isSurahDownloaded('minshawi', 112)).toBe(true);
  });

  test('concurrent requests for the same surah share one download', async () => {
    const { fs, downloader } = setup();
    const params = { reciter: 'minshawi', surahNumber: 112, versesCount: 4 };

    const [a, b] = await Promise.all([downloader.downloadSurah(params), downloader.downloadSurah(params)]);
    expect(a).toEqual(b);
    expect(fs.requested).toHaveLength(4);
  });

  test('respects the concurrency limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fs = createFakeFs();
    const original = fs.downloadFile;
    fs.downloadFile = async (args) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        return await original(args);
      } finally {
        inFlight -= 1;
      }
    };
    const downloader = createAudioDownloader({
      fs,
      storage: createMemoryStorage(),
      baseDir: BASE,
      getVerseAudioUrl: urlFor,
      concurrency: 3,
    });

    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 2, versesCount: 20 });
    expect(maxInFlight).toBe(3);
  });

  test('cancelling stops the download and does not record the surah', async () => {
    const { fs, downloader } = setup(undefined, { concurrency: 1 });
    const promise = downloader.downloadSurah({
      reciter: 'minshawi',
      surahNumber: 2,
      versesCount: 50,
      onProgress: ({ done }) => {
        if (done === 2) downloader.cancelDownload('minshawi', 2);
      },
    });

    await expect(promise).rejects.toBeInstanceOf(DownloadCancelledError);
    expect(fs.requested.length).toBeLessThan(50);
    expect(downloader.isDownloading('minshawi', 2)).toBe(false);
    expect(await downloader.isSurahDownloaded('minshawi', 2)).toBe(false);
    expect([...fs.files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  });
});

describe('deleting and storage', () => {
  test('deleteSurah removes its files and its index entry only', async () => {
    const { fs, downloader } = setup();
    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 });
    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 113, versesCount: 5 });

    await downloader.deleteSurah('minshawi', 112, 4);

    expect(await downloader.isSurahDownloaded('minshawi', 112)).toBe(false);
    expect(await downloader.isSurahDownloaded('minshawi', 113)).toBe(true);
    expect([...fs.files.keys()].filter((p) => p.includes('/112'))).toEqual([]);
    expect([...fs.files.keys()].filter((p) => p.includes('/113'))).toHaveLength(5);
  });

  test('totalBytes counts the audio files on disk across reciters', async () => {
    const { downloader } = setup();
    expect(await downloader.totalBytes()).toBe(0);

    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 });
    await downloader.downloadSurah({ reciter: 'maher', surahNumber: 108, versesCount: 3 });
    expect(await downloader.totalBytes()).toBe(7000);
    expect(await downloader.listDownloaded()).toHaveLength(2);
  });

  test('deleteAll removes every file and clears the index', async () => {
    const { fs, downloader } = setup();
    await downloader.downloadSurah({ reciter: 'minshawi', surahNumber: 112, versesCount: 4 });
    await downloader.deleteAll();

    expect(fs.files.size).toBe(0);
    expect(await downloader.listDownloaded()).toEqual([]);
    expect(await downloader.totalBytes()).toBe(0);
  });

  test('a corrupt index is treated as empty', async () => {
    const { storage, downloader } = setup();
    storage.data.set('offline.audioIndex', '{oops');
    expect(await downloader.listDownloaded()).toEqual([]);
    expect(await downloader.isSurahDownloaded('minshawi', 1)).toBe(false);
  });
});

describe('formatBytes', () => {
  test('formats megabytes and gigabytes in Arabic', () => {
    expect(formatBytes(0)).toBe('0 ميجابايت');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 ميجابايت');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 ميجابايت');
    expect(formatBytes(2.25 * 1024 * 1024 * 1024)).toBe('2.3 جيجابايت');
  });
});
