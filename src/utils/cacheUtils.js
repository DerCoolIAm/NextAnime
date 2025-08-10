// src/utils/cacheUtils.js

const CACHE_PREFIX = "airingScheduleCache_";
const UPCOMING_CACHE_KEY = "upcomingAnimeCache";
const ANIME_DETAILS_CACHE_PREFIX = "animeDetailsCache_";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const UPCOMING_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes for upcoming anime

// Create a key with anime ID
function getCacheKey(animeId) {
  return `${CACHE_PREFIX}${animeId}`;
}

function getAnimeDetailsCacheKey(animeId) {
  return `${ANIME_DETAILS_CACHE_PREFIX}${animeId}`;
}

// Generic cache getter
function getCachedData(key, ttl = CACHE_TTL_MS) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const { timestamp, data } = JSON.parse(cached);
    const now = Date.now();
    if (now - timestamp < ttl) {
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

// Generic cache setter
function setCachedData(key, data, ttl = CACHE_TTL_MS) {
  const payload = {
    timestamp: Date.now(),
    data,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

// Retrieve from cache if not expired
export function getCachedSchedule(animeId) {
  return getCachedData(getCacheKey(animeId));
}

// Save schedule with timestamp
export function setCachedSchedule(animeId, data) {
  setCachedData(getCacheKey(animeId), data);
}

// Upcoming anime cache
export function getCachedUpcomingAnime() {
  return getCachedData(UPCOMING_CACHE_KEY, UPCOMING_CACHE_TTL_MS);
}

export function setCachedUpcomingAnime(data) {
  setCachedData(UPCOMING_CACHE_KEY, data, UPCOMING_CACHE_TTL_MS);
}

// Anime details cache
export function getCachedAnimeDetails(animeId) {
  return getCachedData(getAnimeDetailsCacheKey(animeId));
}

export function setCachedAnimeDetails(animeId, data) {
  setCachedData(getAnimeDetailsCacheKey(animeId), data);
}

// Clear all caches
export function clearAllCaches() {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX) || 
        key.startsWith(ANIME_DETAILS_CACHE_PREFIX) || 
        key === UPCOMING_CACHE_KEY) {
      localStorage.removeItem(key);
    }
  });
}

// Get cache stats
export function getCacheStats() {
  const keys = Object.keys(localStorage);
  const scheduleCache = keys.filter(k => k.startsWith(CACHE_PREFIX)).length;
  const detailsCache = keys.filter(k => k.startsWith(ANIME_DETAILS_CACHE_PREFIX)).length;
  const upcomingCache = keys.includes(UPCOMING_CACHE_KEY) ? 1 : 0;
  
  return {
    scheduleCache,
    detailsCache,
    upcomingCache,
    total: scheduleCache + detailsCache + upcomingCache
  };
}
