/**
 * Outbox: a persistent queue of writes made while offline, replayed in order
 * once the server is reachable again.
 *
 * Pure logic — storage and handlers are injected, so it runs under plain jest.
 */

/**
 * Whether a failed request is worth retrying later. Anything else (a 4xx such
 * as 400/403/404) will fail the same way every time, so the operation is
 * dropped instead of blocking the queue forever.
 */
export const isRetryableError = (error) => {
  const status = error?.response?.status;
  if (!status) return true; // no response at all: offline, timeout, DNS…
  return status >= 500 || status === 401 || status === 408 || status === 429;
};

export const newOperationId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

/**
 * @param {Object} deps
 * @param {{getItem: Function, setItem: Function}} deps.storage  AsyncStorage-like
 * @param {Object<string, (payload: Object) => Promise>} deps.handlers  one per operation type
 * @param {string} [deps.storageKey]
 */
export const createOutbox = ({ storage, handlers, storageKey = 'offline.outbox' }) => {
  let flushing = null;
  const listeners = new Set();

  const load = async () => {
    try {
      const raw = await storage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const save = async (operations) => {
    await storage.setItem(storageKey, JSON.stringify(operations));
    listeners.forEach((listener) => listener(operations.length));
  };

  const enqueue = async (type, payload) => {
    const operations = await load();
    const operation = { id: newOperationId(), type, payload, createdAt: new Date().toISOString() };
    operations.push(operation);
    await save(operations);
    return operation;
  };

  const pending = () => load();

  const clear = () => save([]);

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const runFlush = async () => {
    const result = { synced: 0, dropped: 0, remaining: 0 };

    // Operations are replayed strictly in order: a later one may depend on an
    // earlier one (e.g. reviewing a verse that was memorized offline).
    for (;;) {
      const operations = await load();
      if (operations.length === 0) break;

      const [operation] = operations;
      const handler = handlers[operation.type];
      let outcome;

      if (!handler) {
        outcome = 'dropped';
      } else {
        try {
          await handler(operation.payload);
          outcome = 'synced';
        } catch (error) {
          if (isRetryableError(error)) {
            result.remaining = operations.length;
            return result;
          }
          outcome = 'dropped';
        }
      }

      // Re-read before removing: operations may have been enqueued meanwhile.
      const latest = await load();
      await save(latest.filter((op) => op.id !== operation.id));
      result[outcome] += 1;
    }

    return result;
  };

  /** Replays the queue. Concurrent calls share one run. */
  const flush = () => {
    if (!flushing) {
      flushing = runFlush().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  };

  return { enqueue, pending, clear, flush, subscribe };
};
