// src/utils/cacheUtils.js

const CACHE_PREFIX = "airingScheduleCache_";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Create a key with anime ID
function getCacheKey(animeId) {
  return `${CACHE_PREFIX}${animeId}`;
}

// Retrieve from cache if not expired
export function getCachedSchedule(animeId) {
  const key = getCacheKey(animeId);
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const { timestamp, data } = JSON.parse(cached);
    const now = Date.now();
    if (now - timestamp < CACHE_TTL_MS) {
      return data;
    } else {
      localStorage.removeItem(key); // stale, clean up
      return null;
    }
  } catch (e) {
    localStorage.removeItem(key); // corrupt, clean up
    return null;
  }
}

// Save schedule with timestamp
export function setCachedSchedule(animeId, data) {
  const key = getCacheKey(animeId);
  const payload = {
    timestamp: Date.now(),
    data,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}
