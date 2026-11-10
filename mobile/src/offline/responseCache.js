/**
 * Last-known-good cache for GET responses, so screens still have data to
 * show without a connection. Pure logic — storage is injected.
 */

export const CACHE_PREFIX = 'offline.cache:';

export const cacheKeyFor = (url, params) => {
  const query = params
    ? Object.keys(params)
        .filter((key) => params[key] !== undefined && params[key] !== null)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&')
    : '';
  return `${CACHE_PREFIX}${url}${query ? `?${query}` : ''}`;
};

export const createResponseCache = ({ storage }) => {
  const put = async (url, params, data) => {
    try {
      await storage.setItem(
        cacheKeyFor(url, params),
        JSON.stringify({ savedAt: new Date().toISOString(), data })
      );
    } catch (error) {
      // A full or unavailable cache must never break a successful request.
    }
  };

  /** Resolves to { data, savedAt } or null when nothing is cached. */
  const get = async (url, params) => {
    try {
      const raw = await storage.getItem(cacheKeyFor(url, params));
      if (!raw) return null;
      const entry = JSON.parse(raw);
      return entry && entry.data !== undefined ? entry : null;
    } catch (error) {
      return null;
    }
  };

  const clear = async () => {
    const keys = await storage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await storage.multiRemove(cacheKeys);
    }
  };

  return { put, get, clear };
};
