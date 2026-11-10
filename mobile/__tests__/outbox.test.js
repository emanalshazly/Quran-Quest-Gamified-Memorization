import { createOutbox, isRetryableError } from '../src/offline/outbox';
import { createResponseCache, cacheKeyFor } from '../src/offline/responseCache';

const createMemoryStorage = () => {
  const data = new Map();
  return {
    data,
    getItem: async (key) => (data.has(key) ? data.get(key) : null),
    setItem: async (key, value) => {
      data.set(key, value);
    },
    getAllKeys: async () => [...data.keys()],
    multiRemove: async (keys) => keys.forEach((key) => data.delete(key)),
  };
};

const networkError = () => new Error('Network Error');
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

describe('isRetryableError', () => {
  test('retries when there was no response, on 5xx, 401, 408 and 429', () => {
    expect(isRetryableError(networkError())).toBe(true);
    [500, 503, 401, 408, 429].forEach((status) =>
      expect(isRetryableError(httpError(status))).toBe(true)
    );
  });

  test('does not retry permanent client errors', () => {
    [400, 403, 404, 422].forEach((status) =>
      expect(isRetryableError(httpError(status))).toBe(false)
    );
  });
});

describe('outbox', () => {
  test('replays queued operations in order and empties the queue', async () => {
    const storage = createMemoryStorage();
    const calls = [];
    const outbox = createOutbox({
      storage,
      handlers: { review: async (payload) => calls.push(payload.n) },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.enqueue('review', { n: 2 });
    await outbox.enqueue('review', { n: 3 });

    expect(await outbox.flush()).toEqual({ synced: 3, dropped: 0, remaining: 0 });
    expect(calls).toEqual([1, 2, 3]);
    expect(await outbox.pending()).toEqual([]);
  });

  test('stops at the first network failure and keeps everything from there on', async () => {
    const storage = createMemoryStorage();
    const calls = [];
    const outbox = createOutbox({
      storage,
      handlers: {
        review: async (payload) => {
          calls.push(payload.n);
          if (payload.n === 2) throw networkError();
        },
      },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.enqueue('review', { n: 2 });
    await outbox.enqueue('review', { n: 3 });

    expect(await outbox.flush()).toEqual({ synced: 1, dropped: 0, remaining: 2 });
    expect(calls).toEqual([1, 2]);
    expect((await outbox.pending()).map((op) => op.payload.n)).toEqual([2, 3]);
  });

  test('a later flush finishes what an earlier one could not', async () => {
    const storage = createMemoryStorage();
    let online = false;
    const calls = [];
    const outbox = createOutbox({
      storage,
      handlers: {
        review: async (payload) => {
          if (!online) throw networkError();
          calls.push(payload.n);
        },
      },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.enqueue('review', { n: 2 });
    expect((await outbox.flush()).remaining).toBe(2);

    online = true;
    expect(await outbox.flush()).toEqual({ synced: 2, dropped: 0, remaining: 0 });
    expect(calls).toEqual([1, 2]);
  });

  test('drops an operation the server permanently rejects and carries on', async () => {
    const storage = createMemoryStorage();
    const calls = [];
    const outbox = createOutbox({
      storage,
      handlers: {
        review: async (payload) => {
          if (payload.n === 1) throw httpError(403);
          calls.push(payload.n);
        },
      },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.enqueue('review', { n: 2 });

    expect(await outbox.flush()).toEqual({ synced: 1, dropped: 1, remaining: 0 });
    expect(calls).toEqual([2]);
  });

  test('drops operations of an unknown type', async () => {
    const outbox = createOutbox({ storage: createMemoryStorage(), handlers: {} });
    await outbox.enqueue('mystery', {});
    expect(await outbox.flush()).toEqual({ synced: 0, dropped: 1, remaining: 0 });
  });

  test('the queue survives a restart (a new outbox on the same storage)', async () => {
    const storage = createMemoryStorage();
    await createOutbox({ storage, handlers: {} }).enqueue('review', { n: 7 });

    const calls = [];
    const restarted = createOutbox({
      storage,
      handlers: { review: async (payload) => calls.push(payload.n) },
    });
    await restarted.flush();
    expect(calls).toEqual([7]);
  });

  test('concurrent flushes do not send an operation twice', async () => {
    const storage = createMemoryStorage();
    const calls = [];
    const outbox = createOutbox({
      storage,
      handlers: {
        review: async (payload) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          calls.push(payload.n);
        },
      },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.enqueue('review', { n: 2 });
    await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);
    expect(calls).toEqual([1, 2]);
  });

  test('an operation enqueued while flushing is not lost', async () => {
    const storage = createMemoryStorage();
    const calls = [];
    let outbox;
    outbox = createOutbox({
      storage,
      handlers: {
        review: async (payload) => {
          calls.push(payload.n);
          if (payload.n === 1) await outbox.enqueue('review', { n: 2 });
        },
      },
    });

    await outbox.enqueue('review', { n: 1 });
    await outbox.flush();
    expect(calls).toEqual([1, 2]);
    expect(await outbox.pending()).toEqual([]);
  });

  test('notifies subscribers of the pending count', async () => {
    const outbox = createOutbox({
      storage: createMemoryStorage(),
      handlers: { review: async () => {} },
    });
    const counts = [];
    outbox.subscribe((count) => counts.push(count));

    await outbox.enqueue('review', {});
    await outbox.enqueue('review', {});
    await outbox.flush();
    expect(counts).toEqual([1, 2, 1, 0]);
  });

  test('recovers from corrupt stored data', async () => {
    const storage = createMemoryStorage();
    storage.data.set('offline.outbox', '{not json');
    const outbox = createOutbox({ storage, handlers: {} });
    expect(await outbox.pending()).toEqual([]);
  });
});

describe('response cache', () => {
  test('cache keys ignore parameter order and empty values', () => {
    expect(cacheKeyFor('/a', { b: 2, a: 1, c: undefined })).toBe(cacheKeyFor('/a', { a: 1, b: 2 }));
    expect(cacheKeyFor('/a', { a: 1 })).not.toBe(cacheKeyFor('/a', { a: 2 }));
  });

  test('returns what was stored, and null when nothing was', async () => {
    const cache = createResponseCache({ storage: createMemoryStorage() });
    expect(await cache.get('/surahs')).toBeNull();

    await cache.put('/surahs', undefined, { success: true, surahs: [1, 2] });
    const entry = await cache.get('/surahs');
    expect(entry.data).toEqual({ success: true, surahs: [1, 2] });
    expect(typeof entry.savedAt).toBe('string');
  });

  test('clear removes cached responses but nothing else', async () => {
    const storage = createMemoryStorage();
    const cache = createResponseCache({ storage });
    await cache.put('/kids', undefined, { kids: [] });
    storage.data.set('app.language', 'ar');

    await cache.clear();
    expect(await cache.get('/kids')).toBeNull();
    expect(storage.data.get('app.language')).toBe('ar');
  });
});
