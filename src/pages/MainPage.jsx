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
import React, { useState, useEffect, useRef } from "react";
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

import {
  fetchAiringSchedulesByIds,
  fetchFullAiringSchedule,
  fetchAnimeByName,
  fetchNextAiringSchedules,
  fetchAnimeWithSchedules,
  fetchAnimeByNameWithDetails,
  fetchAiringSchedulesWithDetails,
} from "../utils/anilistApi";
import {
  getCachedUpcomingAnime,
  setCachedUpcomingAnime,
  getCachedAnimeDetails,
  setCachedAnimeDetails,
} from "../utils/cacheUtils";

// Firestore setup
const auth = getAuth(app);
const db = getFirestore(app);

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
  const prevWatchingListIds = useRef(new Set());
  const prevWatchingList = useRef([]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // On login, sync Firestore + localStorage lists
        await syncWatchingList(firebaseUser.uid);
      } else {
        // Logged out: load localStorage only
        const localList = loadWatchingList() || [];
        const fixedList = fixAiringTimes(localList);
        setWatchingList(fixedList);
        prevWatchingListIds.current = new Set(fixedList.map((a) => a.id));
        prevWatchingList.current = fixedList;
      }
    });
    return unsubscribe;
  }, []);

  // Sync Firestore and localStorage watching lists without deleting local data
  async function syncWatchingList(uid) {
    try {
      const firestoreList = await loadFirestoreWatchingList(uid);
      const localList = loadWatchingList() || [];
      const merged = mergeLists(localList, firestoreList);
      const fixedMerged = fixAiringTimes(merged);
      setWatchingList(fixedMerged);
      prevWatchingListIds.current = new Set(fixedMerged.map((a) => a.id));
      prevWatchingList.current = fixedMerged;

      // Save merged back to Firestore and localStorage so both sides are synced
      saveWatchingList(fixedMerged);
      await saveFirestoreWatchingList(uid, fixedMerged);
    } catch (e) {
      console.error("Error syncing watching list:", e);
    }
  }

  // On mount: if no user logged in yet, load localStorage list
  useEffect(() => {
    if (!user) {
      const localList = loadWatchingList() || [];
      const fixedList = fixAiringTimes(localList);
      setWatchingList(fixedList);
      prevWatchingListIds.current = new Set(fixedList.map((a) => a.id));
      prevWatchingList.current = fixedList;
    }
  }, [user]);

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

  // Fetch airing schedules for watching list (optimized with caching)
  useEffect(() => {
    async function loadSchedules() {
      if (watchingList.length === 0) return;

      const currentIds = new Set(watchingList.map((a) => a.id));
      if (areSetsEqual(currentIds, prevWatchingListIds.current)) return;
      prevWatchingListIds.current = currentIds;

      try {
        // Use optimized query that includes full anime details
        const schedulesWithDetails = await fetchAiringSchedulesWithDetails([...currentIds]);

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
                 fullAiringSchedule: scheduleData.media.airingSchedule?.nodes || anime.fullAiringSchedule,
                 nextAiringEpisode: scheduleData.media.nextAiringEpisode || anime.nextAiringEpisode,
               };
            }
            return anime;
          });
          saveWatchingList(updated);
          // Also update Firestore if logged in
          if (user) {
            saveFirestoreWatchingList(user.uid, updated);
          }
          return updated;
        });
      } catch (err) {
        console.error("Error fetching airing schedules:", err);
      }
    }
    loadSchedules();
  }, [watchingList, user]);

  // Save calendarList when it changes
  useEffect(() => {
    saveCalendarList(calendarList);
  }, [calendarList]);

  // Sync calendar list with current favorite status from watching list
  useEffect(() => {
    if (watchingList.length > 0) {
      setCalendarList((prev) => {
        const updatedCalendar = prev.map((ep) => {
          const anime = watchingList.find(a => a.id === ep.id);
          return anime ? { ...ep, favorited: anime.favorited || false } : ep;
        });
        saveCalendarList(updatedCalendar);
        return updatedCalendar;
      });
    }
  }, [watchingList]);

  // Track watching list changes for optimization
  useEffect(() => {
    prevWatchingList.current = watchingList;
  }, [watchingList]);

  // Add anime by name from input field (optimized)
  async function addAnime() {
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

      const updatedAnime = {
        id: detailedAnime.id,
        title: detailedAnime.title,
        coverImage: detailedAnime.coverImage,
        episodes: detailedAnime.episodes || 0,
        status: detailedAnime.status || "UNKNOWN",
        siteUrl: detailedAnime.siteUrl,
        genres: detailedAnime.genres || [],
        cachedEpisodes: 0,
        favorited: false,
        watchedUntil: 0,
        fullAiringSchedule: detailedAnime.airingSchedule?.nodes || [],
        nextAiringEpisode: detailedAnime.nextAiringEpisode || null,
      };

      const updatedList = [...watchingList, updatedAnime];
      setWatchingList(updatedList);
      saveWatchingList(updatedList);

      if (user) {
        await saveFirestoreWatchingList(user.uid, updatedList);
      }

      setAddName("");
    } catch (err) {
      setError("Error fetching anime");
      console.error("Error in addAnime:", err);
    }
  }

  // Add anime from upcoming anime list (optimized)
  async function addAnimeFromUpcoming(animeName) {
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

      const updatedAnime = {
        id: detailedAnime.id,
        title: detailedAnime.title,
        coverImage: detailedAnime.coverImage,
        episodes: detailedAnime.episodes || 0,
        status: detailedAnime.status || "UNKNOWN",
        siteUrl: detailedAnime.siteUrl,
        genres: detailedAnime.genres || [],
        cachedEpisodes: 0,
        favorited: false,
        watchedUntil: 0,
        fullAiringSchedule: detailedAnime.airingSchedule?.nodes || [],
        nextAiringEpisode: detailedAnime.nextAiringEpisode || null,
      };

      const updatedList = [...watchingList, updatedAnime];
      setWatchingList(updatedList);
      saveWatchingList(updatedList);

      if (user) {
        await saveFirestoreWatchingList(user.uid, updatedList);
      }
    } catch (err) {
      setError("Error fetching anime");
      console.error("Error in addAnimeFromUpcoming:", err);
    }
  }

  function handleToggleCalendar(anime) {
    setCalendarList((prev) => {
      const isInCalendar = prev.some((ep) => ep.id === anime.id);

      if (isInCalendar) {
        const filtered = prev.filter((ep) => ep.id !== anime.id);
        saveCalendarList(filtered);
        return filtered;
      } else {
        const episodesToAdd = (anime.fullAiringSchedule || []).map((ep) => ({
          id: anime.id,
          title: anime.title,
          coverImage: anime.coverImage,
          episode: ep.episode,
          airingAt: ep.airingAt,
          favorited: anime.favorited || false,
        }));

        const updated = [...prev, ...episodesToAdd];
        saveCalendarList(updated);
        return updated;
      }
    });
  }

  function deleteAnime(id) {
    const filtered = watchingList.filter((a) => a.id !== id);
    setWatchingList(filtered);
    saveWatchingList(filtered);

    if (user) {
      saveFirestoreWatchingList(user.uid, filtered);
    }

    const filteredCalendar = calendarList.filter((a) => a.id !== id);
    setCalendarList(filteredCalendar);
    saveCalendarList(filteredCalendar);
  }

  // Open/close edit modal
  function handleOpenEdit(anime) {
    setEditTarget(anime);
  }
  function handleCloseEdit() {
    setEditTarget(null);
  }

  // Adjust release time helpers
  function applyUpdateAndPersist(updatedList) {
    setWatchingList(updatedList);
    saveWatchingList(updatedList);
    if (user) {
      saveFirestoreWatchingList(user.uid, updatedList);
    }
    // Also update calendar with adjusted times
    setCalendarList((prev) => {
      const updatedCalendar = prev.map((ep) => {
        const src = updatedList.find((a) => a.id === ep.id);
        if (!src) return ep;
        return {
          ...ep,
          airingAt: src.fullAiringSchedule?.find((n) => n.episode === ep.episode)?.airingAt || ep.airingAt,
          title: src.title,
          coverImage: src.coverImage,
          favorited: src.favorited || false,
        };
      });
      saveCalendarList(updatedCalendar);
      return updatedCalendar;
    });
  }

  function withAdjustedSchedule(anime, newFirstTs) {
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
  }

  function handleSaveReleaseTimestamp(id, newTsSeconds) {
    const updated = watchingList.map((a) => (a.id === id ? withAdjustedSchedule(a, newTsSeconds) : a));
    applyUpdateAndPersist(updated);
  }

  function handleAdjustOffsetSeconds(id, offsetSeconds) {
    const target = watchingList.find((a) => a.id === id);
    if (!target) return;
    const newTs = (target.airingAt || Math.floor(Date.now() / 1000)) + offsetSeconds;
    handleSaveReleaseTimestamp(id, newTs);
  }

  function handleResetReleaseTime(id) {
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
  }

  function toggleFavorite(id) {
    const updated = watchingList.map((a) =>
      a.id === id ? { ...a, favorited: !a.favorited } : a
    );
    setWatchingList(updated);
    saveWatchingList(updated);

    if (user) {
      saveFirestoreWatchingList(user.uid, updated);
    }

    // Update calendar list to reflect favorite status changes
    const anime = updated.find(a => a.id === id);
    if (anime) {
      setCalendarList((prev) => {
        const updatedCalendar = prev.map((ep) => 
          ep.id === id ? { ...ep, favorited: anime.favorited } : ep
        );
        saveCalendarList(updatedCalendar);
        return updatedCalendar;
      });
    }
  }

  const sortedWatchingList = [...watchingList].sort((a, b) => {
    // First, sort by favorite status (favorites first)
    if (a.favorited && !b.favorited) return -1;
    if (!a.favorited && b.favorited) return 1;
    
    // Then, within each group (favorites and non-favorites), sort by airing time
    return (a.airingAt || 0) - (b.airingAt || 0);
  });

  function areSetsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }

  // Helper function to check if anime is completed
  function isAnimeCompleted(anime) {
    // Check if anime status is FINISHED or if it has no next airing episode and all episodes are aired
    if (anime.status === "FINISHED") return true;
    
    // If no next airing episode and we have episode count, check if all episodes are done
    if (!anime.nextAiringEpisode && anime.episodes && anime.episodes > 0) {
      // Check if the last episode in the airing schedule is the final episode
      if (anime.fullAiringSchedule && anime.fullAiringSchedule.length > 0) {
        const lastEpisode = anime.fullAiringSchedule[anime.fullAiringSchedule.length - 1];
        return lastEpisode.episode >= anime.episodes;
      }
    }
    
    return false;
  }

  return (
          <div
        style={{
          minHeight: "100vh",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: "#eee",
          backgroundColor: "#121212",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        {/* Custom CSS for responsive design */}
        <style>{`
          @media (max-width: 768px) {
            .anime-scroll-container {
              scroll-snap-type: x mandatory;
            }
            .anime-scroll-container > * {
              scroll-snap-align: start;
            }
          }
          
          @media (max-width: 480px) {
            .anime-scroll-container {
              gap: 8px !important;
              padding: 8px !important;
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
        `}</style>
      {/* Fixed Header Elements */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: 150,
          color: "white",
          padding: "4px 8px",
          fontSize: "clamp(10px, 1.5vw, 12px)",
          fontWeight: "bold",
          borderRadius: 4,
          zIndex: 1001,
          userSelect: "none",
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(10px)",
        }}
      >
        {VERSION}
      </div>

      {/* Responsive Container */}
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "clamp(10px, 3vw, 30px)",
          paddingTop: "80px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          gap: "clamp(20px, 4vw, 40px)",
        }}
      >
        {/* Navigation Header */}
        <div
          style={{
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
          }}
        >
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button
              onClick={() => navigate("/cache")}
              title="View Cached Data"
              style={{
                backgroundColor: "rgba(97, 218, 251, 0.1)",
                border: "1px solid rgba(97, 218, 251, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "clamp(16px, 2.5vw, 20px)",
                cursor: "pointer",
                color: "#61dafb",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.2)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              🧠 Cache
            </button>
          </div>

          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button
              onClick={() => navigate("/animelist")}
              title="View Anime List"
              style={{
                marginLeft: "50px",
                backgroundColor: "rgba(97, 218, 251, 0.1)",
                border: "1px solid rgba(97, 218, 251, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "clamp(16px, 2.5vw, 20px)",
                cursor: "pointer",
                color: "#61dafb",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.2)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              📘 List
            </button>
            <button
              onClick={() => navigate("/calendar")}
              title="View Calendar"
              style={{
                backgroundColor: "rgba(97, 218, 251, 0.1)",
                border: "1px solid rgba(97, 218, 251, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "clamp(16px, 2.5vw, 20px)",
                cursor: "pointer",
                color: "#61dafb",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.2)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              📅 Calendar
            </button>
            {/* User Login Button */}
              {user ? (
            <button
              onClick={() => navigate("/user")}
              title={`Logged in as ${user.email}`}
              style={{
                backgroundColor: "rgba(97, 218, 251, 0.1)",
                border: "1px solid rgba(97, 218, 251, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "clamp(16px, 2.5vw, 20px)",
                cursor: "pointer",
                color: "#61dafb",
                zIndex: 1001,
                fontWeight: "bold",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.2)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              👤 {user.email?.split('@')[0]}
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              title="Login or Signup"
              style={{
                backgroundColor: "rgba(97, 218, 251, 0.1)",
                border: "1px solid rgba(97, 218, 251, 0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "clamp(16px, 2.5vw, 20px)",
                cursor: "pointer",
                color: "#61dafb",
                zIndex: 1001,
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.2)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(97, 218, 251, 0.1)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              🔐 Login
            </button>
          )}
          </div>
        </div>

        {/* Duplicate Popup */}
        {showDuplicatePopup && (
          <div
            style={{
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
            }}
          >
            This anime is already in your watching list!
          </div>
        )}

        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(25px, 5vw, 40px)" }}>
          {/* Page Title / Logo */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "64px",
              overflow: "visible",
            }}
          >
            <img
              src={appLogo}
              alt="App logo"
              style={{
                height: "250px",
                width: "auto",
                transform: "scale(2.2)",
                transformOrigin: "center center",
                filter: "drop-shadow(0 2px 10px rgba(97, 218, 251, 0.3))",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Add Anime Section */}
          <div
            style={{
              backgroundColor: "rgba(40, 40, 40, 0.8)",
              padding: "clamp(20px, 4vw, 30px)",
              borderRadius: "16px",
              textAlign: "center",
              border: "1px solid rgba(97, 218, 251, 0.2)",
              backdropFilter: "blur(10px)",
            }}
          >
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
                style={{
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
                }}
                className="add-button"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(97, 218, 251, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(97, 218, 251, 0.3)";
                }}
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
            <h2
              style={{
                textAlign: "center",
                marginBottom: "clamp(20px, 4vw, 30px)",
                fontSize: "clamp(20px, 4vw, 28px)",
                fontWeight: 700,
                color: "#61dafb",
                textShadow: "0 2px 10px rgba(97, 218, 251, 0.3)",
              }}
            >
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
        />
      </div>
    </div>
  );
}
