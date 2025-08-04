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
} from "../utils/anilistApi";

// One-time fix function
function fixAiringTimes(watchingList) {
  const now = Date.now() / 1000;

  return watchingList.map((anime) => {
    if (
      anime.airingAt &&
      anime.airingAt < now &&
      anime.fullAiringSchedule?.length // you use fullAiringSchedule in your code
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
  const VERSION = "v1.0.1";

  // Track previous watchingList IDs for comparison
  const prevWatchingListIds = useRef(new Set());

  // On mount: load watching list, fix airing times once, save and set state
  useEffect(() => {
    let storedList = loadWatchingList() || [];
    const fixedList = fixAiringTimes(storedList);
    setWatchingList(fixedList);
    saveWatchingList(fixedList);
    prevWatchingListIds.current = new Set(fixedList.map((a) => a.id));
  }, []);

  // Fetch general upcoming anime (for UpcomingAnimeVertical)
  useEffect(() => {
    async function loadUpcoming() {
      try {
        const upcoming = await fetchNextAiringSchedules(10);
        setEpisodes(upcoming);
      } catch (err) {
        console.error("Error fetching upcoming anime:", err);
      }
    }
    loadUpcoming();
  }, []);

  // Fetch airing schedules for watching list (batched, on change of IDs)
  useEffect(() => {
    async function loadSchedules() {
      if (watchingList.length === 0) return;

      const currentIds = new Set(watchingList.map((a) => a.id));
      // Skip if IDs haven't changed
      if (areSetsEqual(currentIds, prevWatchingListIds.current)) return;
      prevWatchingListIds.current = currentIds;

      try {
        const schedules = await fetchAiringSchedulesByIds([...currentIds]);

        setWatchingList((oldList) => {
          const updated = oldList.map((anime) => {
            const schedule = schedules.find((sch) => sch.media.id === anime.id);
            return {
              ...anime,
              episode: schedule?.episode ?? anime.episode,
              airingAt: schedule?.airingAt ?? anime.airingAt,
            };
          });
          saveWatchingList(updated);
          return updated;
        });
      } catch (err) {
        console.error("Error fetching airing schedules:", err);
      }
    }
    loadSchedules();
  }, [watchingList]);

  // Save calendarList when it changes
  useEffect(() => {
    saveCalendarList(calendarList);
  }, [calendarList]);

  // --- FIXED: Only fetch full airing schedule for newly added anime ---
  const prevWatchingList = useRef(watchingList);

  useEffect(() => {
    async function fetchScheduleForNewAnime() {
      // Detect newly added anime by comparing IDs
      const oldIds = new Set(prevWatchingList.current.map((a) => a.id));
      const newAnime = watchingList.find((a) => !oldIds.has(a.id));

      if (!newAnime) {
        prevWatchingList.current = watchingList;
        return; // no new anime, skip
      }

      try {
        const schedule = await fetchFullAiringSchedule(newAnime.id);
        const newEpisodes = schedule.map((ep) => ({
          id: newAnime.id,
          title: newAnime.title,
          coverImage: newAnime.coverImage,
          episode: ep.episode,
          airingAt: ep.airingAt,
        }));

        // (You probably want to do something with newEpisodes here or update state)

      } catch (err) {
        console.error("Error fetching full airing schedule for new anime:", err);
      }

      prevWatchingList.current = watchingList;
    }
    fetchScheduleForNewAnime();
  }, [watchingList]);

  // Add anime by name using API helper
  async function addAnime() {
    setError("");
    const searchName = addName.trim();
    if (!searchName) return;

    try {
      const newAnime = await fetchAnimeByName(searchName);

      console.log("Anime to add:", newAnime);
      console.log("Calling fetchAnimeWithSchedules with id:", newAnime?.id);

      if (!newAnime) {
        setError("Anime not found on AniList");
        return;
      }

      if (watchingList.some((a) => a.id === newAnime.id)) {
        setShowDuplicatePopup(true);
        setTimeout(() => setShowDuplicatePopup(false), 3000);
        return;
      }

      const detailedAnime = await fetchAnimeWithSchedules(newAnime.id);
      if (!detailedAnime) {
        setError("Error fetching detailed anime info. Please try again.");
        return;
      }

      const updatedAnime = {
        id: detailedAnime.id,
        title: detailedAnime.title,
        coverImage: detailedAnime.coverImage,
        episodes: detailedAnime.episodes || 0,
        siteUrl: newAnime.siteUrl,
        genres: newAnime.genres || [],
        cachedEpisodes: 0,
        isFavorite: false,
        watchedUntil: 0,
        fullAiringSchedule: detailedAnime.airingSchedule?.nodes || [],
        nextAiringEpisode: detailedAnime.nextAiringEpisode || null,
      };

      const updatedList = [...watchingList, updatedAnime];
      setWatchingList(updatedList);
      saveWatchingList(updatedList);
      setAddName("");
    } catch (err) {
      setError("Error fetching anime");
      console.error("Error in addAnime:", err);
    }
  }

  function handleToggleCalendar(anime) {
    setCalendarList((prev) => {
      // Check if any episodes of this anime are in the calendar
      const isInCalendar = prev.some((ep) => ep.id === anime.id);

      if (isInCalendar) {
        // Remove all episodes of this anime
        const filtered = prev.filter((ep) => ep.id !== anime.id);
        saveCalendarList(filtered);
        return filtered;
      } else {
        // Add all episodes from fullAiringSchedule as separate calendar entries
        const episodesToAdd = (anime.fullAiringSchedule || []).map((ep) => ({
          id: anime.id,
          title: anime.title,
          coverImage: anime.coverImage,
          episode: ep.episode,
          airingAt: ep.airingAt,
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
  }

  const sortedWatchingList = [...watchingList].sort(
    (a, b) => (a.airingAt || 0) - (b.airingAt || 0)
  );

  // Helper for set equality
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
        position: "relative", // important for absolute positioning inside
      }}
    >
      {/* Version label */}
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

      <UpcomingAnimeVertical episodes={episodes} />
    </div>
  );
}