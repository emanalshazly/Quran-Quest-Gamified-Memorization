import { createOfflineActions } from '../src/offline/actions';

const createMemoryStorage = () => {
  const data = new Map();
  return {
    getItem: async (key) => (data.has(key) ? data.get(key) : null),
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
};

const httpError = (status, message) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { message } } });

/**
 * A stand-in for the backend that follows the same rules as the real routes:
 * reviews are de-duplicated by client_op_id, memorizing a verse twice is a
 * 400, and a score of 70+ passes.
 */
const createFakeServer = () => {
  const state = {
    online: true,
    loseNextResponse: false,
    points: 0,
    reviews: [],
    recordings: 0,
    memorized: new Set(),
    seenOps: new Set(),
  };

  const call = async (apply) => {
    if (!state.online) throw new Error('Network Error');
    const response = apply();
    if (state.loseNextResponse) {
      // The server applied the request, but the reply never reached the app
      state.loseNextResponse = false;
      throw new Error('Network Error');
    }
    return response;
  };

  const memorizationAPI = {
    submitReview: (payload) =>
      call(() => {
        if (payload.client_op_id && state.seenOps.has(payload.client_op_id)) {
          return { success: true, duplicate: true, pointsEarned: 0 };
        }
        state.seenOps.add(payload.client_op_id);
        state.reviews.push(payload);
        state.points += 5;
        return { success: true, pointsEarned: 5 };
      }),
    recordRecitation: () =>
      call(() => {
        state.recordings += 1;
        return { success: true, recording: { id: `rec-${state.recordings}` } };
      }),
    analyzeRecording: (payload) =>
      call(() => ({
        success: true,
        isPassed: payload.accuracy_score >= 70,
        recording: { feedback_ar: 'ملاحظة' },
      })),
    markAsMemorized: (payload) =>
      call(() => {
        if (state.memorized.has(payload.verse_id)) {
          throw httpError(400, 'Verse already memorized');
        }
        state.memorized.add(payload.verse_id);
        state.points += 10;
        return { success: true, pointsEarned: 10, badgesEarned: [] };
      }),
  };

  return { state, memorizationAPI };
};

const setup = () => {
  const server = createFakeServer();
  const actions = createOfflineActions({
    storage: createMemoryStorage(),
    memorizationAPI: server.memorizationAPI,
  });
  return { ...server, ...actions };
};

describe('reviews', () => {
  test('online: sent straight away, nothing queued', async () => {
    const { state, submitReview, outbox } = setup();
    const res = await submitReview({ kid_id: 'k1', verse_id: 1, accuracy_score: 90 });

    expect(res.queued).toBe(false);
    expect(res.pointsEarned).toBe(5);
    expect(state.reviews).toHaveLength(1);
    expect(await outbox.pending()).toHaveLength(0);
  });

  test('offline: queued, then applied exactly once after reconnecting', async () => {
    const { state, submitReview, outbox, pendingVerseIds } = setup();
    state.online = false;

    const res = await submitReview({ kid_id: 'k1', verse_id: 1, accuracy_score: 90 });
    await submitReview({ kid_id: 'k1', verse_id: 2, accuracy_score: 75 });
    expect(res).toMatchObject({ success: true, queued: true });
    expect(state.reviews).toHaveLength(0);
    expect(await pendingVerseIds('k1', 'review')).toEqual([1, 2]);
    expect(await pendingVerseIds('other-kid', 'review')).toEqual([]);

    state.online = true;
    expect(await outbox.flush()).toEqual({ synced: 2, dropped: 0, remaining: 0 });
    await outbox.flush();

    expect(state.reviews.map((r) => r.verse_id)).toEqual([1, 2]);
    expect(state.points).toBe(10);
    expect(await pendingVerseIds('k1', 'review')).toEqual([]);
  });

  test('offline review keeps the time it actually happened', async () => {
    const { state, submitReview, outbox } = setup();
    state.online = false;
    const before = Date.now();
    await submitReview({ kid_id: 'k1', verse_id: 1, accuracy_score: 90 });

    state.online = true;
    await outbox.flush();
    const reviewedAt = new Date(state.reviews[0].reviewed_at).getTime();
    expect(reviewedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(reviewedAt).toBeLessThanOrEqual(Date.now());
  });

  test('a review whose response was lost is not counted twice on replay', async () => {
    const { state, submitReview, outbox } = setup();
    state.loseNextResponse = true;

    const res = await submitReview({ kid_id: 'k1', verse_id: 1, accuracy_score: 90 });
    expect(res.queued).toBe(true); // the app could not tell it had succeeded
    expect(state.points).toBe(5); // …but the server had applied it

    expect(await outbox.flush()).toEqual({ synced: 1, dropped: 0, remaining: 0 });
    expect(state.reviews).toHaveLength(1);
    expect(state.points).toBe(5);
  });

  test('a rejected review is reported to the caller, not queued', async () => {
    const { memorizationAPI, submitReview, outbox } = setup();
    memorizationAPI.submitReview = async () => {
      throw httpError(404, 'Verse not memorized yet');
    };

    await expect(submitReview({ kid_id: 'k1', verse_id: 1, accuracy_score: 90 })).rejects.toThrow();
    expect(await outbox.pending()).toHaveLength(0);
  });
});

describe('recitation tests', () => {
  const attempt = { kid_id: 'k1', verse_id: 7, audio_url: 'file://a', duration_seconds: 6, score: 85, already_memorized: false };

  test('online pass: memorized and points awarded', async () => {
    const { state, submitTestResult } = setup();
    const res = await submitTestResult(attempt);

    expect(res).toMatchObject({ queued: false, isPassed: true, pointsEarned: 10, memorized: true });
    expect(state.memorized.has(7)).toBe(true);
  });

  test('online fail: not memorized', async () => {
    const { state, submitTestResult } = setup();
    const res = await submitTestResult({ ...attempt, score: 55 });

    expect(res).toMatchObject({ queued: false, isPassed: false, memorized: false });
    expect(state.memorized.size).toBe(0);
  });

  test('offline pass: queued, shown as memorized locally, synced later', async () => {
    const { state, submitTestResult, outbox, pendingVerseIds } = setup();
    state.online = false;

    const res = await submitTestResult(attempt);
    expect(res).toMatchObject({ queued: true, isPassed: true, pointsEarned: 0, memorized: false });
    expect(await pendingVerseIds('k1', 'test_result')).toEqual([7]);

    state.online = true;
    await outbox.flush();
    expect(state.memorized.has(7)).toBe(true);
    expect(state.points).toBe(10);
    expect(await pendingVerseIds('k1', 'test_result')).toEqual([]);
  });

  test('offline fail is not listed as memorized', async () => {
    const { state, submitTestResult, pendingVerseIds } = setup();
    state.online = false;
    await submitTestResult({ ...attempt, score: 55 });
    expect(await pendingVerseIds('k1', 'test_result')).toEqual([]);
  });

  test('a memorize whose response was lost does not block the queue or double the points', async () => {
    const { state, memorizationAPI, submitTestResult, outbox } = setup();
    const realMemorize = memorizationAPI.markAsMemorized;
    memorizationAPI.markAsMemorized = (payload) => {
      state.loseNextResponse = true;
      memorizationAPI.markAsMemorized = realMemorize;
      return realMemorize(payload);
    };

    const res = await submitTestResult(attempt);
    expect(res.queued).toBe(true);
    expect(state.points).toBe(10);

    expect(await outbox.flush()).toEqual({ synced: 1, dropped: 0, remaining: 0 });
    expect(state.points).toBe(10);
  });

  test('memorize then review of the same verse, both offline, replay in order', async () => {
    const { state, memorizationAPI, submitTestResult, submitReview, outbox } = setup();
    const realReview = memorizationAPI.submitReview;
    memorizationAPI.submitReview = async (payload) => {
      if (state.online && !state.memorized.has(payload.verse_id)) {
        throw httpError(404, 'Verse not memorized yet');
      }
      return realReview(payload);
    };

    state.online = false;
    await submitTestResult(attempt);
    await submitReview({ kid_id: 'k1', verse_id: 7, accuracy_score: 90 });

    state.online = true;
    expect(await outbox.flush()).toEqual({ synced: 2, dropped: 0, remaining: 0 });
    expect(state.points).toBe(15);
  });
});
