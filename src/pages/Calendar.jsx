import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "../firebase";
import { loadCalendarList, saveCalendarList } from "../utils/storage";
import {
  loadWatchedAnime,
  saveWatchedAnime,
  saveFirestoreWatchedAnime,
  syncWatchedAnime,
} from "../utils/watchedAnime";
import WeekNavigation from "../components/WeekNavigation";
import WeekView from "../components/WeekView";
import UnwatchedList from "../components/UnwatchedList";

const auth = getAuth(app);
const db = getFirestore(app);

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


function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekDates(startDate) {
  const week = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(startDate, i));
  }
  return week;
}

function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6);
  const options = { month: 'short', day: 'numeric' };

  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  } else {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${endDate.getFullYear()}`;
  }
}

export default function Calendar() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const [calendarList, setCalendarList] = useState(() => loadCalendarList());
  const [user, setUser] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAll, setShowAll] = useState(() => {
    const saved = localStorage.getItem("showAllEpisodes");
    return saved === "true";
  });

  const [showUnwatched, setShowUnwatched] = useState(false);
  const [watchedState, setWatchedState] = useState(() => loadWatchedAnime());
  
  // Debounced save function for Firebase
  const debouncedSaveCalendarList = useRef(null);
  const debouncedSaveWatchedAnime = useRef(null);

  useEffect(() => {
    debouncedSaveCalendarList.current = debounce(saveCalendarList, 300);
    debouncedSaveWatchedAnime.current = debounce((uid, map) => {
      saveWatchedAnime(map);
      if (uid) {
        saveFirestoreWatchedAnime(uid, map);
      }
    }, 400);
  }, []);

  // Auth listener to sync calendar list and watched progress from Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Sync calendar list from Firestore
        try {
          const firestoreList = await loadFirestoreCalendarList(firebaseUser.uid);
          const localList = loadCalendarList() || [];
          
          // Merge calendar lists - prefer entries with more recent data
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
          
          // Save merged back to Firestore and localStorage so both sides are synced
          saveCalendarList(merged);
          await saveFirestoreCalendarList(firebaseUser.uid, merged);
        } catch (e) {
          console.error("Error syncing calendar list:", e);
        }

        // Sync watched episode progress across devices
        try {
          const mergedWatched = await syncWatchedAnime(firebaseUser.uid);
          setWatchedState(mergedWatched);
        } catch (e) {
          console.error("Error syncing watched anime:", e);
        }
      } else {
        // Logged out: load localStorage only
        const localList = loadCalendarList() || [];
        setCalendarList(localList);
        setWatchedState(loadWatchedAnime());
      }
    });
    return unsubscribe;
  }, []);

  // Refresh watchedState from localStorage when opening the drawer
  useEffect(() => {
    if (!showUnwatched) return;
    setWatchedState(loadWatchedAnime());
  }, [showUnwatched]);

  const handleToggleWatched = useCallback((anime) => {
    if (!anime?.id || anime.episode == null) return;

    const prev = watchedState;
    const currentWatched = prev[anime.id] || 0;
    let newWatched;

    if (currentWatched === anime.episode || currentWatched > anime.episode) {
      newWatched = anime.episode - 1;
    } else {
      newWatched = anime.episode;
    }

    const updated = { ...prev };
    if (newWatched <= 0) {
      delete updated[anime.id];
    } else {
      updated[anime.id] = newWatched;
    }

    setWatchedState(updated);
    saveWatchedAnime(updated);
    if (user?.uid) {
      if (debouncedSaveWatchedAnime.current) {
        debouncedSaveWatchedAnime.current(user.uid, updated);
      } else {
        saveFirestoreWatchedAnime(user.uid, updated);
      }
    }
  }, [user, watchedState]);

  useEffect(() => {
    if (debouncedSaveCalendarList.current) {
      debouncedSaveCalendarList.current(calendarList);
    }
    if (user) {
      debounce(() => saveFirestoreCalendarList(user.uid, calendarList), 500)();
    }
  }, [calendarList, user]);

  useEffect(() => {
    // Allow normal page scrolling, especially on mobile/tablet
    return () => {};
  }, []);

  // Filter calendarList based on showAll toggle
  const filteredCalendarList = React.useMemo(() => {
    if (showAll) {
      return calendarList;
    }
    // Only next upcoming episode per anime
    const now = Date.now();
    const nextEpisodesMap = new Map();

    calendarList.forEach((ep) => {
      if (!ep.airingAt) return;

      const airingMs = ep.airingAt * 1000;
      if (airingMs < now) return;

      const existing = nextEpisodesMap.get(ep.id);
      if (!existing || airingMs < existing.airingAt * 1000) {
        nextEpisodesMap.set(ep.id, ep);
      }
    });

    return Array.from(nextEpisodesMap.values());
  }, [calendarList, showAll]);

  // Group anime by date key and calculate totals
  const animeByDate = {};
  let totalEpisodesThisWeek = 0;

  const weekStart = startDate;
  const weekEnd = addDays(startDate, 6);
  weekEnd.setHours(23, 59, 59, 999);

  filteredCalendarList.forEach((anime) => {
    if (!anime.airingAt) return;
    const airingDate = new Date(anime.airingAt * 1000);
    airingDate.setHours(0, 0, 0, 0);

    if (airingDate >= weekStart && airingDate <= weekEnd) {
      totalEpisodesThisWeek++;
      const key = airingDate.toISOString();
      if (!animeByDate[key]) animeByDate[key] = [];
      animeByDate[key].push(anime);
    }
  });

  // Sort animes by favorite status first, then by airingAt ascending for each day
  Object.keys(animeByDate).forEach((key) => {
    animeByDate[key].sort((a, b) => {
      // First, sort by favorite status (favorites first)
      if (a.favorited && !b.favorited) return -1;
      if (!a.favorited && b.favorited) return 1;

      // Then, within each group (favorites and non-favorites), sort by airing time
      return a.airingAt - b.airingAt;
    });
  });

  const weekDates = getWeekDates(startDate);

  function handleRemoveFromCalendar(id) {
    setCalendarList((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      if (user) {
        debounce(() => saveFirestoreCalendarList(user.uid, filtered), 500)();
      }
      return filtered;
    });
  }

  // Navigation handlers
  function handlePrevWeek() {
    setStartDate((prev) => addDays(prev, -7));
    setWeekOffset((prev) => prev - 1);
  }

  function handleNextWeek() {
    setStartDate((prev) => addDays(prev, 7));
    setWeekOffset((prev) => prev + 1);
  }

  function handlePrevDay() {
    setStartDate((prev) => addDays(prev, -1));
    const newStartDate = addDays(startDate, -1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((newStartDate - today) / (1000 * 60 * 60 * 24));
    setWeekOffset(Math.floor(daysDiff / 7));
  }

  function handleNextDay() {
    setStartDate((prev) => addDays(prev, 1));
    const newStartDate = addDays(startDate, 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((newStartDate - today) / (1000 * 60 * 60 * 24));
    setWeekOffset(Math.floor(daysDiff / 7));
  }

  function handleToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
    setWeekOffset(0);
  }

  const isCurrentWeek = weekOffset === 0;
  const weekRangeText = formatWeekRange(startDate);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400,
        margin: "20px auto",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#eee",
        padding: "16px",
        paddingBottom: "10px",
        backgroundColor: "#121212",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
        minHeight: "60vh",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .calendar-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }
        
        /* Custom scrollbar for calendar */
        .calendar-scroll::-webkit-scrollbar {
          height: 8px;
        }
        
        .calendar-scroll::-webkit-scrollbar-track {
          background: rgba(97, 218, 251, 0.1);
          border-radius: 4px;
        }
        
        .calendar-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #61dafb, #6dd6ff);
          border-radius: 4px;
        }
        
        .calendar-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #6dd6ff, #61dafb);
        }
      `}</style>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
        className="calendar-header"
      >
        <div>
          <h2 style={{ fontWeight: "700", fontSize: "1.6rem", margin: 0 }}>
            📅 Weekly Anime Schedule
          </h2>
          <p style={{ margin: "8px 0 0 0", fontSize: "1rem", color: "#ccc" }}>
            {weekRangeText}
            {isCurrentWeek && (
              <span style={{ color: "#61dafb", fontWeight: "bold" }}> (Today)</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div
            style={{
              backgroundColor: "#282828",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Total Episodes This Week:{" "}
            <span style={{ color: "#61dafb" }}>{totalEpisodesThisWeek}</span>
          </div>

          <button
            onClick={() => {
              setShowAll((prev) => {
                const next = !prev;
                localStorage.setItem("showAllEpisodes", next);
                return next;
              });
            }}
            style={{
              backgroundColor: showAll ? "#4caf50" : "#888",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "700",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
            title="Toggle showing all episodes or only next upcoming"
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            {showAll ? "Show Only Next Episodes" : "Show All Episodes"}
          </button>

          <button
            onClick={() => setShowUnwatched(true)}
            style={{
              backgroundColor: "#7c4dff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "700",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
            title="Show unwatched episodes"
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            🎯 Not Watched
          </button>

          <button
            onClick={() => navigate(-1)}
            style={{
              backgroundColor: "#61dafb",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: "700",
              color: "#333",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 10px rgba(97, 218, 251, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 4px 15px rgba(97, 218, 251, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 10px rgba(97, 218, 251, 0.3)";
            }}
          >
            ← Back
          </button>
        </div>
      </header>

      {/* Unwatched Drawer */}
      {showUnwatched && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1500,
          }}
          onClick={() => setShowUnwatched(false)}
        >
          <div
            style={{
              width: "min(90vw, 420px)",
              height: "100%",
              backgroundColor: "#1e1e1e",
              borderLeft: "1px solid #333",
              padding: 16,
              overflowY: "auto",
              scrollbarWidth: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Not Watched</h3>
              <button
                onClick={() => setShowUnwatched(false)}
                style={{ 
                  background: "#444", 
                  border: "none", 
                  color: "#fff", 
                  padding: "6px 10px", 
                  borderRadius: 6, 
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#555"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#444"}
              >
                ✕ Close
              </button>
            </div>

            <UnwatchedList calendarList={calendarList} watchedState={watchedState} />
          </div>
        </div>
      )}

      <WeekNavigation
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        currentStartDate={startDate}
        weekOffset={weekOffset}
        isCurrentWeek={isCurrentWeek}
      />

      <div
        ref={calendarRef}
        className="calendar-scroll"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <WeekView
          weekDates={weekDates}
          animeByDate={animeByDate}
          onRemove={handleRemoveFromCalendar}
          isCurrentWeek={isCurrentWeek}
          watchedState={watchedState}
          onToggleWatched={handleToggleWatched}
        />
      </div>

      {/* Delete button fade animation styles */}
      <style>{`
        .anime-image-container {
          position: relative;
        }

        .anime-image-container .remove-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(255, 0, 0, 0.85);
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          color: white;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .anime-image-container:hover .remove-btn,
        .anime-image-container .remove-btn:hover {
          opacity: 1;
        }

        .anime-image-container:hover .anime-cover-image {
          opacity: 0.4;
        }
      `}</style>

    </div>
  );
}