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
  const navigate = useNavigate();
  const VERSION = "Beta v2.0.0";

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

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#eee",
        padding: "0 20px",
        backgroundColor: "#121212",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          color: "white",
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: "bold",
          borderRadius: 4,
          zIndex: 1001,
          userSelect: "none",
        }}
      >
        {VERSION}
      </div>

      {showDuplicatePopup && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            backgroundColor: "rgba(255, 69, 58, 0.95)",
            color: "white",
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
            fontWeight: "700",
            zIndex: 1000,
          }}
        >
          This anime is already in your watching list!
        </div>
      )}

      <button
        onClick={() => navigate("/calendar")}
        title="View Calendar"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          backgroundColor: "transparent",
          border: "none",
          fontSize: 28,
          cursor: "pointer",
          color: "#61dafb",
          zIndex: 10,
        }}
      >
        📅
      </button>
      <button
        onClick={() => navigate("/animelist")}
        title="View Anime List"
        style={{
          position: "absolute",
          top: 20,
          right: 70,
          backgroundColor: "transparent",
          border: "none",
          fontSize: 28,
          cursor: "pointer",
          color: "#61dafb",
          zIndex: 10,
        }}
      >
        📘
      </button>

      <button
        onClick={() => navigate("/cache")}
        title="View Cached Data"
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          backgroundColor: "transparent",
          border: "none",
          fontSize: 28,
          cursor: "pointer",
          color: "#61dafb",
          zIndex: 10,
        }}
      >
        🧠
      </button>
      {user ? (
        <button
          onClick={() => navigate("/user")}
          title={`Logged in as ${user.email}`}
          style={{
            position: "fixed",
            top: 10,
            right: 10,
            backgroundColor: "transparent",
            border: "none",
            fontSize: 28,
            cursor: "pointer",
            color: "#61dafb",
            zIndex: 10,
            fontWeight: "bold",
          }}
        >
          👤
        </button>
      ) : (
        <button
          onClick={() => navigate("/login")}
          title="Login or Signup"
          style={{
            position: "fixed",
            top: 10,
            right: 10,
            backgroundColor: "transparent",
            border: "none",
            fontSize: 28,
            cursor: "pointer",
            color: "#61dafb",
            zIndex: 10,
          }}
        >
          🔐
        </button>
      )}

      <h2
        style={{
          textAlign: "center",
          marginBottom: 30,
          backgroundColor: "#f5f5f5",
          color: "#333",
          padding: "15px 20px",
          borderRadius: 8,
          maxWidth: 400,
          marginLeft: "auto",
          marginRight: "auto",
          fontWeight: 700,
        }}
      >
        📺 Upcoming Anime Episodes
      </h2>

      <div
        style={{
          backgroundColor: "#282828",
          padding: 20,
          borderRadius: 12,
          marginBottom: 30,
          textAlign: "center",
        }}
      >
        <p style={{ marginBottom: 10 }}>
          Your watching list — Add any anime by name:
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <div style={{ width: "300px" }}>
            <AnimeSearchAutocomplete
              value={addName}
              onChange={setAddName}
              onSelect={setAddName}
            />
          </div>
          <button
            onClick={addAnime}
            style={{
              padding: "10px 16px",
              backgroundColor: "#6dd6ff",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: "25px",
            }}
          >
            Add
          </button>
        </div>

        {error && <p style={{ color: "tomato", marginTop: 10 }}>{error}</p>}
      </div>

      <SavedAnimeHorizontal
        watchingList={sortedWatchingList}
        onDelete={deleteAnime}
        onToggleFavorite={toggleFavorite}
        calendarList={calendarList}
        onToggleCalendar={handleToggleCalendar}
      />

      <NewRelease watchingList={watchingList} />

             <UpcomingAnimeVertical 
         episodes={episodes} 
         watchingList={watchingList}
         onAddAnime={addAnimeFromUpcoming}
       />
    </div>
  );
}
