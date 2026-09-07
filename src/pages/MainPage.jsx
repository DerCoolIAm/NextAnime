import {
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { app } from "../firebase";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SavedAnimeHorizontal from "../components/SavedAnimeHorizontal";
import UpcomingAnimeVertical from "../components/UpcomingAnimeVertical";
import AnimeSearchAutocomplete from "../components/AnimeSearchAutocomplete";
import NewRelease from "../components/NewRelease";
import AnimeEditModal from "../components/AnimeEditModal";
import appLogo from "../assets/logo.png";
import {
  loadWatchingList,
  saveWatchingList,
  loadCalendarList,
  saveCalendarList,
} from "../utils/storage";
import { syncWatchedAnime } from "../utils/watchedAnime";

import {
  fetchAiringSchedulesByIds,
  fetchFullAiringSchedule,
  fetchAnimeByName,
  fetchNextAiringSchedules,
  fetchAnimeWithSchedules,
  fetchAnimeByNameWithDetails,
  fetchAiringSchedulesWithDetails,
  fetchMultipleAnimeDetails,
} from "../utils/anilistApi";
import {
  getCachedUpcomingAnime,
  setCachedUpcomingAnime,
  getCachedAnimeDetails,
  setCachedAnimeDetails,
} from "../utils/cacheUtils";
import {
  LIST_STATUS_OPTIONS,
  DEFAULT_LIST_STATUS,
} from "../constants/listStatuses";

// Firestore setup
const auth = getAuth(app);
const db = getFirestore(app);

// Memoized helper functions
const areSetsEqual = (a, b) => {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
};

// Helper: load watching list from Firestore for given uid
async function loadFirestoreWatchingList(uid) {
  if (!uid) return [];
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().firebasewatchedlist || [];
    }
  } catch (e) {
    console.error("Error loading Firestore watching list:", e);
  }
  return [];
}

// Helper: save watching list to Firestore for given uid
async function saveFirestoreWatchingList(uid, list) {
  if (!uid) return;
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { firebasewatchedlist: list }, { merge: true });
  } catch (e) {
    console.error("Error saving Firestore watching list:", e);
  }
}

// Helper: load calendar list from Firestore for given uid
async function loadFirestoreCalendarList(uid) {
  if (!uid) return [];
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().firebasecalendarlist || [];
    }
  } catch (e) {
    console.error("Error loading Firestore calendar list:", e);
  }
  return [];
}

// Helper: save calendar list to Firestore for given uid
async function saveFirestoreCalendarList(uid, list) {
  if (!uid) return;
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { firebasecalendarlist: list }, { merge: true });
  } catch (e) {
    console.error("Error saving Firestore calendar list:", e);
  }
}

// Provider priority order: higher number = higher priority
const PROVIDER_PRIORITY = {
  "Crunchyroll": 5,
  "Netflix": 4,
  "Prime Video": 3,
  "Disney+": 2,
  "AniList": 1,
};

// Get priority for a provider name (case-insensitive)
function getProviderPriority(siteName) {
  if (!siteName) return 0;
  const normalized = siteName.toLowerCase();
  for (const [key, priority] of Object.entries(PROVIDER_PRIORITY)) {
    if (normalized.includes(key.toLowerCase())) {
      return priority;
    }
  }
  return 0;
}

// Get the best provider URL based on priority
function getBestProviderUrlFromLinks(externalLinks, defaultSiteUrl) {
  if (!externalLinks || externalLinks.length === 0) {
    return defaultSiteUrl || "";
  }
  
  // Find the highest priority provider from externalLinks
  const sorted = [...externalLinks].sort((a, b) => {
    const priorityA = getProviderPriority(a.site);
    const priorityB = getProviderPriority(b.site);
    return priorityB - priorityA; // Higher priority first
  });
  
  // Return the highest priority provider
  if (sorted[0]) {
    return sorted[0].url;
  }
  
  // Fallback to AniList siteUrl
  return defaultSiteUrl || "";
}

// Merge two lists of anime, prefer local entries but add missing from Firestore
function mergeLists(localList, firestoreList) {
  const map = new Map();

  // Add all local entries first (preserves local edits)
  for (const anime of localList) {
    map.set(anime.id, anime);
  }

  // Add Firestore entries if not present locally
  for (const anime of firestoreList) {
    if (!map.has(anime.id)) {
      map.set(anime.id, anime);
    }
  }

  return Array.from(map.values());
}


function normalizeAnimeEntry(anime) {
  if (!anime) return anime;
  return {
    ...anime,
    listStatus: anime.listStatus || DEFAULT_LIST_STATUS,
    watchedEpisodes: anime.watchedEpisodes ?? 0,
    score: anime.score ?? 0,
  };
}

function normalizeAnimeList(list) {
  return (list || []).map(normalizeAnimeEntry);
}

// Ensure every anime that appears in the calendar also exists in the watching list
function ensureWatchingFromCalendar(watchingList, calendarList) {
  const byId = new Map((watchingList || []).map((a) => [a.id, a]));
  const additions = [];
  const seen = new Set();

  (calendarList || []).forEach((ep) => {
    if (!ep?.id) return;
    if (seen.has(ep.id) || byId.has(ep.id)) return;
    seen.add(ep.id);

    additions.push(
      normalizeAnimeEntry({
        id: ep.id,
        title: ep.title,
        coverImage: ep.coverImage,
        // We only know the streaming link info stored on the calendar entry
        siteUrl: ep.siteUrl || ep.externalLinks?.[0]?.url || "",
        externalLinks: ep.externalLinks || [],
        favorited: ep.favorited || false,
        episodes: 0,
        status: "UNKNOWN",
        watchedEpisodes: 0,
        score: 0,
        listStatus: DEFAULT_LIST_STATUS,
      })
    );
  });

  if (additions.length === 0) return watchingList;
  return [...(watchingList || []), ...additions];
}
function fixAiringTimes(watchingList) {
  const now = Date.now() / 1000;

  return watchingList.map((anime) => {
    // Skip updating airing times for completed anime
    if (anime.status === "FINISHED") {
      return anime;
    }

    if (
      anime.airingAt &&
      anime.airingAt < now &&
      anime.fullAiringSchedule?.length
    ) {
      const nextEp = anime.fullAiringSchedule.find((ep) => ep.airingAt > now);
      if (nextEp) {
        return {
          ...anime,
          airingAt: nextEp.airingAt,
          episode: nextEp.episode,
        };
      }
    }
    return anime;
  });
}

// Memoized CSS styles to prevent recreation
const styles = {
  container: {
    minHeight: "100vh",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: "#eee",
    backgroundColor: "#121212",
    position: "relative",
    overflowX: "hidden",
  },
  responsiveContainer: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "clamp(10px, 3vw, 30px)",
    paddingTop: "80px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    gap: "clamp(20px, 4vw, 40px)",
    width: "100%",
    boxSizing: "border-box",
  },
  fixedHeader: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(18, 18, 18, 0.95)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(97, 218, 251, 0.2)",
    zIndex: 1000,
    padding: "10px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    width: "100%",
    boxSizing: "border-box",
  },
  buttonBase: {
    backgroundColor: "rgba(97, 218, 251, 0.1)",
    border: "1px solid rgba(97, 218, 251, 0.3)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "clamp(16px, 2.5vw, 20px)",
    cursor: "pointer",
    color: "#61dafb",
    transition: "all 0.3s ease",
  },
  duplicatePopup: {
    position: "fixed",
    top: "80px",
    right: "20px",
    backgroundColor: "rgba(255, 69, 58, 0.95)",
    color: "white",
    padding: "clamp(10px, 2vw, 15px) clamp(15px, 3vw, 25px)",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    fontWeight: "700",
    zIndex: 1000,
    fontSize: "clamp(12px, 2vw, 14px)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 69, 58, 0.3)",
  },
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "64px",
    overflow: "visible",
  },
  logo: {
    height: "250px",
    width: "auto",
    transform: "scale(2.2)",
    transformOrigin: "center center",
    filter: "drop-shadow(0 2px 10px rgba(97, 218, 251, 0.3))",
    userSelect: "none",
    pointerEvents: "none",
  },
  addSection: {
    backgroundColor: "rgba(40, 40, 40, 0.8)",
    padding: "clamp(20px, 4vw, 30px)",
    borderRadius: "16px",
    textAlign: "center",
    border: "1px solid rgba(97, 218, 251, 0.2)",
    backdropFilter: "blur(10px)",
  },
  addButton: {
    padding: "clamp(10px, 2vw, 15px) clamp(16px, 3vw, 24px)",
    background: "linear-gradient(135deg, #61dafb, #6dd6ff)",
    color: "#000",
    fontWeight: "bold",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "clamp(14px, 2.5vw, 16px)",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 15px rgba(97, 218, 251, 0.3)",
  },
  sectionTitle: {
    textAlign: "center",
    marginBottom: "clamp(20px, 4vw, 30px)",
    fontSize: "clamp(20px, 4vw, 28px)",
    fontWeight: 700,
    color: "#61dafb",
    textShadow: "0 2px 10px rgba(97, 218, 251, 0.3)",
  }
};

export default function MainPage() {
  const [episodes, setEpisodes] = useState([]);
  const [watchingList, setWatchingList] = useState([]);
  const [calendarList, setCalendarList] = useState(loadCalendarList());
  const [error, setError] = useState("");
  const [addName, setAddName] = useState("");
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const navigate = useNavigate();
  const VERSION = "Beta v2.0.4";

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState(null);
  const prevWatchingListIds = useRef(new Set());
  const prevWatchingList = useRef([]);
  const autoRefreshIntervalRef = useRef(null);

  // Debounced functions for better performance
  const debouncedSaveWatchingList = useRef(null);
  const debouncedSaveCalendarList = useRef(null);

  useEffect(() => {
    debouncedSaveWatchingList.current = debounce(saveWatchingList, 300);
    debouncedSaveCalendarList.current = debounce(saveCalendarList, 300);
  }, []);

  // Debounce utility
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const AUTO_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 3; // 3 hours
  const AUTO_REFRESH_SOON_WINDOW_SEC = 60 * 60 * 24 * 14; // 14 days
  const AUTO_REFRESH_LAST_KEY = "lastAutoAnimeRefreshAt";

  function shouldAutoRefreshNow() {
    try {
      const last = Number(localStorage.getItem(AUTO_REFRESH_LAST_KEY) || "0");
      return !last || Date.now() - last >= AUTO_REFRESH_INTERVAL_MS;
    } catch {
      return true;
    }
  }

  function markAutoRefreshRun() {
    try {
      localStorage.setItem(AUTO_REFRESH_LAST_KEY, String(Date.now()));
    } catch {}
  }

  function pickAnimeIdsToAutoRefresh(list) {
    const nowSec = Math.floor(Date.now() / 1000);
    const ids = [];

    for (const anime of list || []) {
      if (!anime?.id) continue;
      if (anime.status === "FINISHED") continue;

      // If we already have fresh cached details (24h TTL in cacheUtils), skip.
      const cached = getCachedAnimeDetails(anime.id);
      if (cached) continue;

      const nextAiringAt = anime.nextAiringEpisode?.airingAt || anime.airingAt || null;
      const hasSchedule = Array.isArray(anime.fullAiringSchedule) && anime.fullAiringSchedule.length > 0;

      // Refresh if we don't have schedule data, or the next airing is soon.
      const airingSoon =
        typeof nextAiringAt === "number" && nextAiringAt > nowSec && nextAiringAt - nowSec <= AUTO_REFRESH_SOON_WINDOW_SEC;

      if (!hasSchedule || airingSoon || nextAiringAt == null) {
        ids.push(anime.id);
      }
    }

    return ids;
  }

  // Memoized completed anime checker
  const isAnimeCompleted = useCallback((anime) => {
    if (anime.status === "FINISHED") return true;

    const totalEpisodes = anime.episodes || 0;
    
    // Check if nextAiringEpisode exists and if its episode number >= total episodes
    if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode) {
      if (totalEpisodes > 0 && anime.nextAiringEpisode.episode >= totalEpisodes) {
        return true;
      }
    }
    
    const hasNoNext = !anime.nextAiringEpisode || !anime.nextAiringEpisode.airingAt;

    if (totalEpisodes > 0 && hasNoNext) {
      if (Array.isArray(anime.fullAiringSchedule) && anime.fullAiringSchedule.length > 0) {
        const lastEpisode = anime.fullAiringSchedule[anime.fullAiringSchedule.length - 1];
        if (lastEpisode && typeof lastEpisode.episode === "number") {
          return lastEpisode.episode >= totalEpisodes;
        }
      }
      // If schedule missing but episodes known and no next episode, assume completed
      return true;
    }

    return false;
  }, []);

  // Memoized sorted watching list
  const sortedWatchingList = useMemo(() => {
    const now = Date.now() / 1000;
    const activeWatching = watchingList.filter((anime) => (anime.listStatus || DEFAULT_LIST_STATUS) === DEFAULT_LIST_STATUS);

    return [...activeWatching].sort((a, b) => {
      if (a.favorited && !b.favorited) return -1;
      if (!a.favorited && b.favorited) return 1;

      const aCompleted = isAnimeCompleted(a);
      const bCompleted = isAnimeCompleted(b);
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      const aHasCountdown = a.airingAt && a.airingAt > now;
      const bHasCountdown = b.airingAt && b.airingAt > now;
      if (aHasCountdown !== bHasCountdown) {
        return aHasCountdown ? -1 : 1;
      }

      const aAiringAt = a.airingAt ?? Number.MAX_SAFE_INTEGER;
      const bAiringAt = b.airingAt ?? Number.MAX_SAFE_INTEGER;
      if (aAiringAt !== bAiringAt) {
        return aAiringAt - bAiringAt;
      }

      const aTitle = a.title?.english || a.title?.romaji || "";
      const bTitle = b.title?.english || b.title?.romaji || "";
      return aTitle.localeCompare(bTitle);
    });
  }, [watchingList, isAnimeCompleted]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Load username from Firestore, then sync lists
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUsername(data.username || null);
          } else {
            setUsername(null);
          }
        } catch (e) {
          console.warn("Could not load username:", e);
          setUsername(null);
        }
        // On login, sync Firestore + localStorage lists
        await syncWatchingList(firebaseUser.uid);
        await syncCalendarList(firebaseUser.uid);
        await syncWatchedAnime(firebaseUser.uid);

        // Kick off an auto-refresh (rate-limited) and keep it running every 3 hours.
        // Clear any previous interval first.
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
        }
        autoRefreshAnimeData(false);
        autoRefreshIntervalRef.current = setInterval(() => {
          autoRefreshAnimeData(false);
        }, AUTO_REFRESH_INTERVAL_MS);
      } else {
        // Logged out: clear username and load localStorage only
        setUsername(null);
        if (autoRefreshIntervalRef.current) {
          clearInterval(autoRefreshIntervalRef.current);
          autoRefreshIntervalRef.current = null;
        }
        const localList = loadWatchingList() || [];
        const fixedList = fixAiringTimes(localList);
        setWatchingList(fixedList);
        prevWatchingListIds.current = new Set(fixedList.map((a) => a.id));
        prevWatchingList.current = fixedList;
      }
    });
    return unsubscribe;
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, []);

  // Sync Firestore and localStorage watching lists without deleting local data
  const syncWatchingList = useCallback(async (uid) => {
    try {
      const firestoreList = await loadFirestoreWatchingList(uid);
      const localList = loadWatchingList() || [];
      const merged = mergeLists(localList, firestoreList);
      const fixedMerged = fixAiringTimes(merged);
      const normalized = normalizeAnimeList(fixedMerged);
      setWatchingList(normalized);
      prevWatchingListIds.current = new Set(normalized.map((a) => a.id));
      prevWatchingList.current = normalized;

      // Save merged back to Firestore and localStorage so both sides are synced
      saveWatchingList(normalized);
      await saveFirestoreWatchingList(uid, normalized);
    } catch (e) {
      console.error("Error syncing watching list:", e);
    }
  }, []);

  // Sync Firestore and localStorage calendar lists without deleting local data
  const syncCalendarList = useCallback(async (uid) => {
    try {
      const firestoreList = await loadFirestoreCalendarList(uid);
      const localList = loadCalendarList() || [];
      
      // Merge calendar lists - prefer entries with more recent data
      // Use a map to avoid duplicates by anime id + episode
      const calendarMap = new Map();
      
      // Add local entries first (preserves local edits)
      localList.forEach((ep) => {
        const key = `${ep.id}-${ep.episode}`;
        calendarMap.set(key, ep);
      });
      
      // Add Firestore entries if not present locally
      firestoreList.forEach((ep) => {
        const key = `${ep.id}-${ep.episode}`;
        if (!calendarMap.has(key)) {
          calendarMap.set(key, ep);
        }
      });
      
      const merged = Array.from(calendarMap.values());
      setCalendarList(merged);

      // Make sure every calendar anime has a corresponding watching-list entry
      setWatchingList((prevWatching) => {
        const updatedWatching = ensureWatchingFromCalendar(prevWatching, merged);
        if (updatedWatching !== prevWatching) {
          saveWatchingList(updatedWatching);
          saveFirestoreWatchingList(uid, updatedWatching);
        }
        return updatedWatching;
      });

      // Save merged back to Firestore and localStorage so both sides are synced
      saveCalendarList(merged);
      await saveFirestoreCalendarList(uid, merged);
    } catch (e) {
      console.error("Error syncing calendar list:", e);
    }
  }, []);

  // Optimized update and persist function
  const applyUpdateAndPersist = useCallback((updatedList) => {
    setWatchingList(updatedList);
    if (debouncedSaveWatchingList.current) {
      debouncedSaveWatchingList.current(updatedList);
    }
    if (user) {
      debounce(() => saveFirestoreWatchingList(user.uid, updatedList), 500)();
    }
    // Also update calendar with adjusted times
    setCalendarList((prev) => {
      const updatedCalendar = prev.map((ep) => {
        const src = updatedList.find((a) => a.id === ep.id);
        if (!src) return ep;
        return {
          ...ep,
          airingAt: src.fullAiringSchedule?.find((n) => n.episode === ep.episode)?.airingAt || ep.airingAt,
          title: {
            ...src.title,
            customTitle: src.customTitle || ep.title?.customTitle || undefined
          },
          coverImage: src.coverImage,
          favorited: src.favorited || false,
          siteUrl: src.siteUrl || ep.siteUrl,
          externalLinks: src.externalLinks || ep.externalLinks || [],
        };
      });
      if (debouncedSaveCalendarList.current) {
        debouncedSaveCalendarList.current(updatedCalendar);
      }
      if (user) {
        debounce(() => saveFirestoreCalendarList(user.uid, updatedCalendar), 500)();
      }
      return updatedCalendar;
    });
  }, [user]);

  // Auto refresh: use the shared applyUpdateAndPersist helper
  const autoRefreshAnimeData = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && !shouldAutoRefreshNow()) return;
    if (!watchingList?.length) return;

    const idsToRefresh = pickAnimeIdsToAutoRefresh(watchingList);
    if (idsToRefresh.length === 0) {
      markAutoRefreshRun();
      return;
    }

    try {
      const updatedAnimeData = await fetchMultipleAnimeDetails(idsToRefresh);
      if (!updatedAnimeData?.length) {
        markAutoRefreshRun();
        return;
      }

      const updatedList = watchingList.map((anime) => {
        const freshData = updatedAnimeData.find((a) => a?.id === anime.id);
        if (!freshData) return anime;

        setCachedAnimeDetails(anime.id, freshData);

        const preservedSiteUrl = anime.siteUrl || freshData.siteUrl;
        const preservedExternalLinks =
          (anime.externalLinks && anime.externalLinks.length > 0)
            ? anime.externalLinks
            : (freshData.externalLinks || []);

        return normalizeAnimeEntry({
          ...anime,
          title: freshData.title || anime.title,
          coverImage: freshData.coverImage || anime.coverImage,
          episodes: freshData.episodes ?? anime.episodes,
          status: freshData.status || anime.status,
          siteUrl: preservedSiteUrl,
          genres: freshData.genres || anime.genres,
          externalLinks: preservedExternalLinks,
          fullAiringSchedule: freshData.airingSchedule?.nodes || anime.fullAiringSchedule,
          nextAiringEpisode: freshData.nextAiringEpisode ?? null,
          airingAt: freshData.nextAiringEpisode?.airingAt ?? anime.airingAt,
          episode: freshData.nextAiringEpisode?.episode ?? anime.episode,
        });
      });

      applyUpdateAndPersist(updatedList);
      markAutoRefreshRun();
    } catch (err) {
      console.error("Auto refresh failed:", err);
      // Don't spam errors in UI for background refreshes.
      markAutoRefreshRun();
    }
  }, [user, watchingList, applyUpdateAndPersist]);

  // On mount: if no user logged in yet, load localStorage list
  useEffect(() => {
    if (!user) {
      const localList = loadWatchingList() || [];
      const fixedList = fixAiringTimes(localList);
      const normalized = normalizeAnimeList(fixedList);
      setWatchingList(normalized);
      prevWatchingListIds.current = new Set(normalized.map((a) => a.id));
      prevWatchingList.current = normalized;
    }
  }, [user]);

  const handleChangeListStatus = useCallback((id, nextStatus) => {
    if (!LIST_STATUS_OPTIONS.includes(nextStatus)) {
      return;
    }
    const updated = watchingList.map((anime) =>
      anime.id === id ? { ...anime, listStatus: nextStatus } : anime
    );
    applyUpdateAndPersist(updated);
  }, [watchingList, applyUpdateAndPersist]);

  const handleRenameTitle = useCallback((id, newTitle) => {
    const updated = watchingList.map((anime) =>
      anime.id === id ? { ...anime, customTitle: newTitle } : anime
    );
    applyUpdateAndPersist(updated);
    
    // Also update calendar list with the new custom title
    setCalendarList((prev) => {
      const updatedCalendar = prev.map((ep) => {
        if (ep.id === id) {
          const anime = updated.find((a) => a.id === id);
          if (anime) {
            return {
              ...ep,
              title: {
                ...anime.title,
                customTitle: newTitle || undefined
              },
            };
          }
        }
        return ep;
      });
      if (debouncedSaveCalendarList.current) {
        debouncedSaveCalendarList.current(updatedCalendar);
      }
      if (user) {
        debounce(() => saveFirestoreCalendarList(user.uid, updatedCalendar), 500)();
      }
      return updatedCalendar;
    });
  }, [watchingList, applyUpdateAndPersist, user]);


  // Fetch general upcoming anime (with caching)
  useEffect(() => {
    async function loadUpcoming() {
      try {
        // Check cache first
        const cached = getCachedUpcomingAnime();
        if (cached) {
          setEpisodes(cached);
          return;
        }

        // Fetch from API if not cached
        const upcoming = await fetchNextAiringSchedules(10);
        setEpisodes(upcoming);
        setCachedUpcomingAnime(upcoming);
      } catch (err) {
        console.error("Error fetching upcoming anime:", err);
      }
    }
    loadUpcoming();
  }, []);

  // Optimized fetch airing schedules effect with better dependency tracking
  useEffect(() => {
    let isCancelled = false;

    async function loadSchedules() {
      if (watchingList.length === 0) return;

      const currentIds = new Set(watchingList.map((a) => a.id));
      if (areSetsEqual(currentIds, prevWatchingListIds.current)) return;
      prevWatchingListIds.current = currentIds;

      try {
        // Use optimized query that includes full anime details
        const schedulesWithDetails = await fetchAiringSchedulesWithDetails([...currentIds]);
        
        if (isCancelled) return;

        setWatchingList((oldList) => {
          const updated = oldList.map((anime) => {
            const scheduleData = schedulesWithDetails.find((sch) => sch.media.id === anime.id);
            if (scheduleData) {
              // Cache the full anime details for future use
              setCachedAnimeDetails(anime.id, scheduleData.media);
              
              return {
                ...anime,
                episode: scheduleData.episode ?? anime.episode,
                airingAt: scheduleData.airingAt ?? anime.airingAt,
                // Update with fresh data if available
                title: scheduleData.media.title || anime.title,
                coverImage: scheduleData.media.coverImage || anime.coverImage,
                episodes: scheduleData.media.episodes || anime.episodes,
                status: scheduleData.media.status || anime.status,
                siteUrl: scheduleData.media.siteUrl || anime.siteUrl,
                genres: scheduleData.media.genres || anime.genres,
                externalLinks: scheduleData.media.externalLinks || anime.externalLinks || [],
                fullAiringSchedule: scheduleData.media.airingSchedule?.nodes || anime.fullAiringSchedule,
                nextAiringEpisode: scheduleData.media.nextAiringEpisode || anime.nextAiringEpisode,
              };
            }
            return anime;
          });
          
          // Use debounced save to prevent excessive writes
          if (debouncedSaveWatchingList.current) {
            debouncedSaveWatchingList.current(updated);
          }
          
          // Also update Firestore if logged in (debounced)
          if (user && !isCancelled) {
            debounce(() => saveFirestoreWatchingList(user.uid, updated), 500)();
          }
          
          return updated;
        });
      } catch (err) {
        if (!isCancelled) {
          console.error("Error fetching airing schedules:", err);
        }
      }
    }
    
    loadSchedules();
    
    return () => {
      isCancelled = true;
    };
  }, [watchingList.map(a => a.id).join(','), user]); // More stable dependency

  // Optimized calendar list save effect
  useEffect(() => {
    if (debouncedSaveCalendarList.current) {
      debouncedSaveCalendarList.current(calendarList);
    }
    if (user) {
      debounce(() => saveFirestoreCalendarList(user.uid, calendarList), 500)();
    }
  }, [calendarList, user]);

  // Sync calendar list with current favorite status, siteUrl, and externalLinks from watching list
  useEffect(() => {
    if (watchingList.length > 0) {
      setCalendarList((prev) => {
        const updatedCalendar = prev.map((ep) => {
          const anime = watchingList.find(a => a.id === ep.id);
          if (anime) {
            return {
              ...ep,
              favorited: anime.favorited || false,
              siteUrl: anime.siteUrl || ep.siteUrl,
              externalLinks: anime.externalLinks || ep.externalLinks || [],
            };
          }
          return ep;
        });
        if (debouncedSaveCalendarList.current) {
          debouncedSaveCalendarList.current(updatedCalendar);
        }
        if (user) {
          debounce(() => saveFirestoreCalendarList(user.uid, updatedCalendar), 500)();
        }
        return updatedCalendar;
      });
    }
  }, [watchingList, user]);

  // Track watching list changes for optimization
  useEffect(() => {
    prevWatchingList.current = watchingList;
  }, [watchingList]);

  // Memoized button hover handlers
  const createButtonHoverHandlers = useCallback((hoverColor = "rgba(97, 218, 251, 0.2)") => ({
    onMouseEnter: (e) => {
      e.currentTarget.style.backgroundColor = hoverColor;
      e.currentTarget.style.transform = "scale(1.05)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
      e.currentTarget.style.transform = "scale(1)";
    }
  }), []);

  const addButtonHoverHandlers = useMemo(() => ({
    onMouseEnter: (e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 6px 20px rgba(97, 218, 251, 0.4)";
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 4px 15px rgba(97, 218, 251, 0.3)";
    }
  }), []);

  // Optimized add anime functions
  const addAnime = useCallback(async () => {
    setError("");
    const searchName = String(addName || "").trim();
    if (!searchName) return;

    try {
      // Use optimized query that gets all details in one request
      const detailedAnime = await fetchAnimeByNameWithDetails(searchName);

      if (!detailedAnime) {
        setError("Anime not found on AniList");
        return;
      }

      if (watchingList.some((a) => a.id === detailedAnime.id)) {
        setShowDuplicatePopup(true);
        setTimeout(() => setShowDuplicatePopup(false), 3000);
        return;
      }

      // Cache the anime details for future use
      setCachedAnimeDetails(detailedAnime.id, detailedAnime);

      // Get the best provider URL based on priority
      const bestProviderUrl = getBestProviderUrlFromLinks(
        detailedAnime.externalLinks || [],
        detailedAnime.siteUrl
      );

      const updatedAnime = {
        id: detailedAnime.id,
        title: detailedAnime.title,
        coverImage: detailedAnime.coverImage,
        episodes: detailedAnime.episodes || 0,
        status: detailedAnime.status || "UNKNOWN",
        siteUrl: bestProviderUrl, // Use best provider based on priority
        genres: detailedAnime.genres || [],
        externalLinks: detailedAnime.externalLinks || [],
        cachedEpisodes: 0,
        favorited: false,
        listStatus: DEFAULT_LIST_STATUS,
        watchedEpisodes: 0,
        score: 0,
        watchedUntil: 0,
        fullAiringSchedule: detailedAnime.airingSchedule?.nodes || [],
        nextAiringEpisode: detailedAnime.nextAiringEpisode || null,
      };

      const updatedList = [...watchingList, updatedAnime];
      const normalizedList = normalizeAnimeList(updatedList);
      setWatchingList(normalizedList);
      saveWatchingList(normalizedList);

      if (user) {
        await saveFirestoreWatchingList(user.uid, normalizedList);
      }

      setAddName("");
    } catch (err) {
      setError("Error fetching anime");
      console.error("Error in addAnime:", err);
    }
  }, [addName, watchingList, user]);

  const addAnimeFromUpcoming = useCallback(async (animeName) => {
    setError("");
    const searchName = String(animeName || "").trim();
    if (!searchName) return;

    try {
      // Use optimized query that gets all details in one request
      const detailedAnime = await fetchAnimeByNameWithDetails(searchName);

      if (!detailedAnime) {
        setError("Anime not found on AniList");
        return;
      }

      if (watchingList.some((a) => a.id === detailedAnime.id)) {
        setShowDuplicatePopup(true);
        setTimeout(() => setShowDuplicatePopup(false), 3000);
        return;
      }

      // Cache the anime details for future use
      setCachedAnimeDetails(detailedAnime.id, detailedAnime);

      // Get the best provider URL based on priority
      const bestProviderUrl = getBestProviderUrlFromLinks(
        detailedAnime.externalLinks || [],
        detailedAnime.siteUrl
      );

      const updatedAnime = {
        id: detailedAnime.id,
        title: detailedAnime.title,
        coverImage: detailedAnime.coverImage,
        episodes: detailedAnime.episodes || 0,
        status: detailedAnime.status || "UNKNOWN",
        siteUrl: bestProviderUrl, // Use best provider based on priority
        genres: detailedAnime.genres || [],
        externalLinks: detailedAnime.externalLinks || [],
        cachedEpisodes: 0,
        favorited: false,
        listStatus: DEFAULT_LIST_STATUS,
        watchedEpisodes: 0,
        score: 0,
        watchedUntil: 0,
        fullAiringSchedule: detailedAnime.airingSchedule?.nodes || [],
        nextAiringEpisode: detailedAnime.nextAiringEpisode || null,
      };

      const updatedList = [...watchingList, updatedAnime];
      const normalizedList = normalizeAnimeList(updatedList);
      setWatchingList(normalizedList);
      saveWatchingList(normalizedList);

      if (user) {
        await saveFirestoreWatchingList(user.uid, normalizedList);
      }
    } catch (err) {
      setError("Error fetching anime");
      console.error("Error in addAnimeFromUpcoming:", err);
    }
  }, [watchingList, user]);

  const handleToggleCalendar = useCallback((anime) => {
    setCalendarList((prev) => {
      const isInCalendar = prev.some((ep) => ep.id === anime.id);

      if (isInCalendar) {
        const filtered = prev.filter((ep) => ep.id !== anime.id);
        if (debouncedSaveCalendarList.current) {
          debouncedSaveCalendarList.current(filtered);
        }
        if (user) {
          debounce(() => saveFirestoreCalendarList(user.uid, filtered), 500)();
        }
        return filtered;
      } else {
        // Add ALL episodes from fullAiringSchedule (past, present, and future)
        // This ensures all episodes are available on the calendar
        let episodesToAdd = [];
        
        if (anime.fullAiringSchedule && anime.fullAiringSchedule.length > 0) {
          // Use fullAiringSchedule which includes all episodes
          episodesToAdd = anime.fullAiringSchedule.map((ep) => ({
            id: anime.id,
            title: anime.title,
            coverImage: anime.coverImage,
            episode: ep.episode,
            airingAt: ep.airingAt,
            favorited: anime.favorited || false,
            siteUrl: anime.siteUrl,
            externalLinks: anime.externalLinks || [],
          }));
        } else if (anime.airingAt && anime.episode) {
          // Fallback: if no full schedule but has current episode info
          episodesToAdd = [{
            id: anime.id,
            title: anime.title,
            coverImage: anime.coverImage,
            episode: anime.episode,
            airingAt: anime.airingAt,
            favorited: anime.favorited || false,
            siteUrl: anime.siteUrl,
            externalLinks: anime.externalLinks || [],
          }];
        }

        const updated = [...prev, ...episodesToAdd];
        if (debouncedSaveCalendarList.current) {
          debouncedSaveCalendarList.current(updated);
        }
        if (user) {
          debounce(() => saveFirestoreCalendarList(user.uid, updated), 500)();
        }
        return updated;
      }
    });
  }, [user]);

  const deleteAnime = useCallback((id) => {
    const filtered = watchingList.filter((a) => a.id !== id);
    setWatchingList(filtered);
    saveWatchingList(filtered);

    if (user) {
      saveFirestoreWatchingList(user.uid, filtered);
    }

    const filteredCalendar = calendarList.filter((a) => a.id !== id);
    setCalendarList(filteredCalendar);
    if (debouncedSaveCalendarList.current) {
      debouncedSaveCalendarList.current(filteredCalendar);
    }
    if (user) {
      debounce(() => saveFirestoreCalendarList(user.uid, filteredCalendar), 500)();
    }
  }, [watchingList, user, calendarList]);

  // Open/close edit modal
  const handleOpenEdit = useCallback((anime) => {
    setEditTarget(anime);
  }, []);
  
  const handleCloseEdit = useCallback(() => {
    setEditTarget(null);
  }, []);

  

  const withAdjustedSchedule = useCallback((anime, newFirstTs) => {
    // Compute delta between desired first upcoming ts and current first upcoming ts
    const now = Date.now() / 1000;
    let nextNode = null;
    if (anime.fullAiringSchedule?.length) {
      nextNode = anime.fullAiringSchedule.find((n) => n.airingAt > now) || anime.fullAiringSchedule[0];
    }
    const currentRefTs = nextNode ? nextNode.airingAt : anime.airingAt || newFirstTs;
    const delta = newFirstTs - currentRefTs;

    const shift = (ts) => (typeof ts === "number" ? ts + delta : ts);

    const adjustedSchedule = (anime.fullAiringSchedule || []).map((n) => ({
      ...n,
      airingAt: shift(n.airingAt),
    }));

    const adjustedAiringAt = shift(anime.airingAt);

    return {
      ...anime,
      airingAt: adjustedAiringAt,
      fullAiringSchedule: adjustedSchedule,
      userTimeOffsetSeconds: (anime.userTimeOffsetSeconds || 0) + delta,
      originalAiringAt: anime.originalAiringAt ?? (anime.airingAt ?? null),
      originalFullAiringSchedule: anime.originalFullAiringSchedule ?? (anime.fullAiringSchedule || []),
    };
  }, []);

  const handleSaveReleaseTimestamp = useCallback((id, newTsSeconds) => {
    const updated = watchingList.map((a) => (a.id === id ? withAdjustedSchedule(a, newTsSeconds) : a));
    applyUpdateAndPersist(updated);
  }, [watchingList, withAdjustedSchedule, applyUpdateAndPersist]);

  const handleAdjustOffsetSeconds = useCallback((id, offsetSeconds) => {
    const target = watchingList.find((a) => a.id === id);
    if (!target) return;
    const newTs = (target.airingAt || Math.floor(Date.now() / 1000)) + offsetSeconds;
    handleSaveReleaseTimestamp(id, newTs);
  }, [watchingList, handleSaveReleaseTimestamp]);

  const handleResetReleaseTime = useCallback((id) => {
    const updated = watchingList.map((a) => {
      if (a.id !== id) return a;
      const baseSchedule = a.originalFullAiringSchedule || a.fullAiringSchedule || [];
      const baseAiring = a.originalAiringAt ?? a.airingAt;
      return {
        ...a,
        fullAiringSchedule: baseSchedule,
        airingAt: baseAiring,
        userTimeOffsetSeconds: 0,
      };
    });
    applyUpdateAndPersist(updated);
  }, [watchingList, applyUpdateAndPersist]);

  const toggleFavorite = useCallback((id) => {
    const updated = watchingList.map((a) =>
      a.id === id ? { ...a, favorited: !a.favorited } : a
    );
    setWatchingList(updated);
    if (debouncedSaveWatchingList.current) {
      debouncedSaveWatchingList.current(updated);
    }

    if (user) {
      debounce(() => saveFirestoreWatchingList(user.uid, updated), 500)();
    }

    // Update calendar list to reflect favorite status changes
    const anime = updated.find(a => a.id === id);
    if (anime) {
      setCalendarList((prev) => {
        const updatedCalendar = prev.map((ep) => 
          ep.id === id ? { ...ep, favorited: anime.favorited } : ep
        );
        if (debouncedSaveCalendarList.current) {
          debouncedSaveCalendarList.current(updatedCalendar);
        }
        if (user) {
          debounce(() => saveFirestoreCalendarList(user.uid, updatedCalendar), 500)();
        }
        return updatedCalendar;
      });
    }
  }, [watchingList, user]);

  // Reset function to refresh all anime data
  const handleResetAnimeData = useCallback(async () => {
    if (watchingList.length === 0) return;
    
    try {
      const animeIds = watchingList.map((a) => a.id);
      const updatedAnimeData = await fetchMultipleAnimeDetails(animeIds);
      
      if (updatedAnimeData.length === 0) return;
      
      const updatedList = watchingList.map((anime) => {
        const freshData = updatedAnimeData.find((a) => a.id === anime.id);
        if (!freshData) return anime;
        
        // Cache the updated anime details
        setCachedAnimeDetails(anime.id, freshData);
        
        // Preserve user-modified siteUrl (don't overwrite if user has set a custom link)
        // Only update externalLinks if they're missing or empty
        const preservedSiteUrl = anime.siteUrl || freshData.siteUrl;
        const preservedExternalLinks = (anime.externalLinks && anime.externalLinks.length > 0) 
          ? anime.externalLinks 
          : (freshData.externalLinks || []);
        
        return {
          ...anime,
          // Update with fresh data
          title: freshData.title || anime.title,
          coverImage: freshData.coverImage || anime.coverImage,
          episodes: freshData.episodes ?? anime.episodes,
          status: freshData.status || anime.status,
          // Preserve existing siteUrl (user-modified links should not be reset)
          siteUrl: preservedSiteUrl,
          genres: freshData.genres || anime.genres,
          // Preserve existing externalLinks if they exist, otherwise use fresh data
          externalLinks: preservedExternalLinks,
          fullAiringSchedule: freshData.airingSchedule?.nodes || anime.fullAiringSchedule,
          // Use fresh nextAiringEpisode even if null (for completed shows)
          nextAiringEpisode: freshData.nextAiringEpisode ?? null,
          // Update airingAt and episode if nextAiringEpisode exists
          airingAt: freshData.nextAiringEpisode?.airingAt ?? anime.airingAt,
          episode: freshData.nextAiringEpisode?.episode ?? anime.episode,
        };
      });
      
      const normalizedList = normalizeAnimeList(updatedList);
      setWatchingList(normalizedList);
      saveWatchingList(normalizedList);
      
      if (user) {
        await saveFirestoreWatchingList(user.uid, normalizedList);
      }
      
      // Update calendar list with fresh data
      setCalendarList((prev) => {
        const updatedCalendar = prev.map((ep) => {
          const anime = normalizedList.find((a) => a.id === ep.id);
          if (!anime) return ep;
          
          // Find the matching episode in the schedule
          const scheduleEp = anime.fullAiringSchedule?.find((s) => s.episode === ep.episode);
          return {
            ...ep,
            airingAt: scheduleEp?.airingAt || ep.airingAt,
            title: anime.title,
            coverImage: anime.coverImage,
            favorited: anime.favorited || false,
            siteUrl: anime.siteUrl || ep.siteUrl,
            externalLinks: anime.externalLinks || ep.externalLinks || [],
          };
        });
        if (debouncedSaveCalendarList.current) {
          debouncedSaveCalendarList.current(updatedCalendar);
        }
        if (user) {
          debounce(() => saveFirestoreCalendarList(user.uid, updatedCalendar), 500)();
        }
        return updatedCalendar;
      });
    } catch (err) {
      console.error("Error resetting anime data:", err);
      setError("Error refreshing anime data");
    }
  }, [watchingList, user]);

  // Memoized navigation handlers
  const navigationHandlers = useMemo(() => ({
    toAnimeList: () => navigate("/animelist"),
    toCalendar: () => navigate("/calendar"),
    toUser: () => navigate("/user"),
    toLogin: () => navigate("/login")
  }), [navigate]);

  return (
    <div style={styles.container}>
      {/* Custom CSS for responsive design */}
      <style>{`
        @media (max-width: 768px) {
          .anime-scroll-container {
            scroll-snap-type: x mandatory;
          }
          .anime-scroll-container > * {
            scroll-snap-align: start;
          }
          .fixed-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
          .fixed-header > div:first-child {
            width: 100%;
          }
          .fixed-header > div:last-child {
            width: 100%;
            justify-content: flex-start;
          }
        }
        
        @media (max-width: 480px) {
          .anime-scroll-container {
            gap: 8px !important;
            padding: 8px !important;
          }
          .fixed-header button {
            font-size: 12px !important;
            padding: 6px 10px !important;
          }
        }

        /* Add Anime controls responsive layout */
        .add-section-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .autocomplete-wrap {
          width: 100%;
          max-width: 500px;
        }
        @media (max-width: 992px) {
          .add-section-controls {
            flex-direction: column;
            align-items: stretch;
          }
          .add-section-controls .add-button {
            width: 100%;
          }
        }
        
        /* Custom scrollbar styling */
        .anime-scroll-container::-webkit-scrollbar {
          height: 6px;
        }
        
        .anime-scroll-container::-webkit-scrollbar-track {
          background: rgba(97, 218, 251, 0.1);
          border-radius: 3px;
        }
        
        .anime-scroll-container::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #61dafb, #6dd6ff);
          border-radius: 3px;
        }
        
        .anime-scroll-container::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #6dd6ff, #61dafb);
        }

        /* Performance optimizations */
        * {
          will-change: auto;
        }
        
        .anime-scroll-container {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
      `}</style>

      {/* Responsive Container */}
      <div style={styles.responsiveContainer}>
        {/* Navigation Header */}
        <div style={styles.fixedHeader}>
          <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleResetAnimeData}
              title="Refresh all anime data (check for new episodes, delays, completion status)"
              style={{
                ...styles.buttonBase,
                backgroundColor: "rgba(97, 218, 251, 0.15)",
                border: "1px solid rgba(97, 218, 251, 0.4)",
                fontSize: "clamp(14px, 2vw, 16px)",
                padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)",
              }}
              {...createButtonHoverHandlers("rgba(97, 218, 251, 0.25)")}
            >
              🔄 Reset
            </button>
          </div>

          <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={navigationHandlers.toAnimeList}
              title="View Anime List"
              style={{ ...styles.buttonBase, marginLeft: "clamp(0px, 2vw, 50px)" }}
              {...createButtonHoverHandlers()}
            >
              📘 List
            </button>
            <button
              onClick={navigationHandlers.toCalendar}
              title="View Calendar"
              style={styles.buttonBase}
              {...createButtonHoverHandlers()}
            >
              📅 Calendar
            </button>
            {/* User Login Button */}
            {user ? (
              <button
                onClick={navigationHandlers.toUser}
                title={`Logged in as ${username || user.email}`}
                style={{ ...styles.buttonBase, fontWeight: "bold" }}
                {...createButtonHoverHandlers()}
              >
                👤 {username || "User"}
              </button>
            ) : (
              <button
                onClick={navigationHandlers.toLogin}
                title="Login or Signup"
                style={styles.buttonBase}
                {...createButtonHoverHandlers()}
              >
                🔐 Login
              </button>
            )}
          </div>
        </div>

        {/* Duplicate Popup */}
        {showDuplicatePopup && (
          <div style={styles.duplicatePopup}>
            This anime is already in your watching list!
          </div>
        )}

        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(25px, 5vw, 40px)" }}>
          {/* Page Title / Logo */}
          <div style={styles.logoContainer}>
            <img
              src={appLogo}
              alt="App logo"
              style={styles.logo}
            />
          </div>

          {/* Add Anime Section */}
          <div style={styles.addSection}>
            <p style={{ 
              marginBottom: "clamp(15px, 3vw, 20px)",
              fontSize: "clamp(14px, 2.5vw, 16px)",
              color: "#ccc"
            }}>
              Your watching list — Add any anime by name:
            </p>

            <div className="add-section-controls">
              <div className="autocomplete-wrap">
                <AnimeSearchAutocomplete
                  value={addName}
                  onChange={setAddName}
                  onSelect={setAddName}
                />
              </div>
              <button
                onClick={addAnime}
                style={styles.addButton}
                className="add-button"
                {...addButtonHoverHandlers}
              >
                Add Anime
              </button>
            </div>

            {error && (
              <p style={{ 
                color: "#ff6b6b", 
                marginTop: "15px",
                fontSize: "clamp(12px, 2vw, 14px)",
                fontWeight: 500
              }}>
                {error}
              </p>
            )}
          </div>

          {/* Watching List Section */}
          <div>
            <h2 style={styles.sectionTitle}>
              🎬 Your Watching List
            </h2>
            <SavedAnimeHorizontal
              watchingList={sortedWatchingList}
              onDelete={deleteAnime}
              onToggleFavorite={toggleFavorite}
              calendarList={calendarList}
              onToggleCalendar={handleToggleCalendar}
              isCompleted={isAnimeCompleted}
              onClickEdit={handleOpenEdit}
              onChangeStatus={handleChangeListStatus}
            onRename={handleRenameTitle}
            />
          </div>

          {/* Upcoming Anime Section */}
          <div>
            <UpcomingAnimeVertical 
              episodes={episodes} 
              watchingList={watchingList}
              onAddAnime={addAnimeFromUpcoming}
            />
          </div>
        </div>

        <NewRelease watchingList={watchingList} />

        {/* Edit Modal */}
        <AnimeEditModal
          anime={editTarget}
          isOpen={!!editTarget}
          onClose={handleCloseEdit}
          onSaveReleaseTimestamp={handleSaveReleaseTimestamp}
          onAdjustOffsetSeconds={handleAdjustOffsetSeconds}
          onResetReleaseTime={handleResetReleaseTime}
          onToggleFavorite={toggleFavorite}
          onDelete={deleteAnime}
          onToggleCalendar={handleToggleCalendar}
          isInCalendar={editTarget ? calendarList.some((a) => a.id === editTarget.id) : false}
          setAnimeList={(updater) => {
            setWatchingList(prevList => {
              const updated = typeof updater === 'function' ? updater(prevList) : updater;
              applyUpdateAndPersist(updated);
              return updated;
            });
          }}
          onRename={handleRenameTitle}
        />
      </div>
    </div>
  );
}
