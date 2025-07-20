// MainPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SavedAnimeHorizontal from "../components/SavedAnimeHorizontal";
import UpcomingAnimeVertical from "../components/UpcomingAnimeVertical";
import {
  loadWatchingList,
  saveWatchingList,
  loadCalendarList,
  saveCalendarList,
} from "../utils/storage";
import { FullAiringSchedule } from "../utils/FullAiringSchedule";

export default function MainPage() {
  const [episodes, setEpisodes] = useState([]);
  const [watchingList, setWatchingList] = useState(loadWatchingList());
  const [calendarList, setCalendarList] = useState(loadCalendarList());
  const [error, setError] = useState("");
  const [addName, setAddName] = useState("");
  const [showDuplicatePopup, setShowDuplicatePopup] = useState(false);
  const navigate = useNavigate();
  const prevWatchingListLength = useRef(watchingList.length);

  useEffect(() => {
    const query = `
      query {
        Page(perPage: 1) {
          airingSchedules(notYetAired: true, sort: TIME) {
            airingAt
            episode
            media {
              id
              title {
                romaji
                english
              }
              coverImage {
                medium
                extraLarge
              }
              genres
              siteUrl
            }
          }
        }
      }
    `;

    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then((res) => res.json())
      .then((data) => setEpisodes(data.data.Page.airingSchedules))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!watchingList.length) return;
    const ids = watchingList.map((a) => a.id);
    const schedulesQuery = `
      query ($ids: [Int]) {
        Page(perPage: 50) {
          airingSchedules(mediaId_in: $ids, notYetAired: true, sort: TIME) {
            airingAt
            episode
            media {
              id
            }
          }
        }
      }
    `;

    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: schedulesQuery, variables: { ids } }),
    })
      .then((res) => res.json())
      .then((data) => {
        const schedules = data.data.Page.airingSchedules;
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
      })
      .catch(console.error);
  }, [watchingList.length]);

  useEffect(() => {
    saveCalendarList(calendarList);
  }, [calendarList]);

  useEffect(() => {
    async function updateCalendarList() {
      if (!watchingList.length) return;
      if (watchingList.length === prevWatchingListLength.current) return;
      prevWatchingListLength.current = watchingList.length;

      try {
        const allSchedules = await Promise.all(
          watchingList.map(async (anime) => {
            const schedule = await FullAiringSchedule(anime.id);
            return schedule.map((ep) => ({
              id: anime.id,
              title: anime.title,
              coverImage: anime.coverImage,
              episode: ep.episode,
              airingAt: ep.airingAt,
            }));
          })
        );
        const flattened = allSchedules.flat();
        setCalendarList(flattened);
        saveCalendarList(flattened);
      } catch (err) {
        console.error("Error fetching full airing schedules:", err);
      }
    }

    updateCalendarList();
  }, [watchingList]);

  async function addAnime() {
    setError("");
    const searchName = addName.trim();
    if (!searchName) return;

    const searchQuery = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            extraLarge
          }
          genres
          siteUrl
        }
      }
    `;

    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, variables: { search: searchName } }),
      });

      const json = await res.json();

      if (json.data?.Media) {
        const newAnime = json.data.Media;
        if (watchingList.some((a) => a.id === newAnime.id)) {
          setShowDuplicatePopup(true);
          setTimeout(() => setShowDuplicatePopup(false), 3000);
          return;
        }

        setWatchingList((prev) => {
          const newList = [...prev, { ...newAnime, episode: null, airingAt: null, favorited: false }];
          saveWatchingList(newList);
          return newList;
        });

        setAddName("");
      } else {
        setError("Anime not found on AniList");
      }
    } catch {
      setError("Error fetching anime");
    }
  }

  function handleToggleCalendar(anime) {
    setCalendarList((prev) => {
      const isInCalendar = prev.some((a) => a.id === anime.id);
      const newList = isInCalendar ? prev.filter((a) => a.id !== anime.id) : [...prev, anime];
      saveCalendarList(newList);
      return newList;
    });
  }

  function deleteAnime(id) {
    const filtered = watchingList.filter((a) => a.id !== id);
    setWatchingList(filtered);
    saveWatchingList(filtered);
  }

  function toggleFavorite(id) {
    const updated = watchingList.map((a) => a.id === id ? { ...a, favorited: !a.favorited } : a);
    setWatchingList(updated);
    saveWatchingList(updated);
  }

  const sortedWatchingList = [...watchingList].sort((a, b) => (a.airingAt || 0) - (b.airingAt || 0));

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#eee", padding: "0 20px", backgroundColor: "#121212", borderRadius: 12, boxShadow: "0 0 20px rgba(0,0,0,0.7)", position: "relative" }}>
      {showDuplicatePopup && (
        <div style={{ position: "fixed", top: 20, right: 20, backgroundColor: "rgba(255, 69, 58, 0.95)", color: "white", padding: "12px 20px", borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.3)", fontWeight: "700", zIndex: 1000 }}>
          This anime is already in your watching list!
        </div>
      )}

      <button
        onClick={() => navigate("/calendar")}
        title="View Calendar"
        style={{ position: "absolute", top: 20, right: 20, backgroundColor: "transparent", border: "none", fontSize: 28, cursor: "pointer", color: "#61dafb", zIndex: 10 }}
      >📅</button>

      <button
        onClick={() => navigate("/cache")}
        title="View Cached Data"
        style={{ position: "absolute", top: 20, left: 20, backgroundColor: "transparent", border: "none", fontSize: 28, cursor: "pointer", color: "#61dafb", zIndex: 10 }}
      >🧠</button>

      <h2 style={{ textAlign: "center", marginBottom: 30, backgroundColor: "#f5f5f5", color: "#333", padding: "15px 20px", borderRadius: 8, maxWidth: 400, marginLeft: "auto", marginRight: "auto", fontWeight: 700 }}>📺 Upcoming Anime Episodes</h2>

      <div style={{ backgroundColor: "#282828", padding: 20, borderRadius: 12, marginBottom: 30, textAlign: "center" }}>
        <p style={{ marginBottom: 10 }}>
          Your watching list — add an anime by name (case insensitive):
        </p>
        <input
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="e.g. attack on titan"
          style={{ padding: "8px 12px", borderRadius: 6, border: "none", marginRight: 10, width: 220, fontSize: 16 }}
        />
        <button onClick={addAnime} style={{ padding: "8px 16px", borderRadius: 6, border: "none", backgroundColor: "#61dafb", fontWeight: 700, cursor: "pointer" }}>Add</button>
        {error && <p style={{ color: "tomato", marginTop: 10 }}>{error}</p>}
      </div>

      <SavedAnimeHorizontal
        watchingList={sortedWatchingList}
        onDelete={deleteAnime}
        onToggleFavorite={toggleFavorite}
        calendarList={calendarList}
        onToggleCalendar={handleToggleCalendar}
      />

      <UpcomingAnimeVertical episodes={episodes} />
    </div>
  );
}
