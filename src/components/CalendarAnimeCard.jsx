import React, { useState, useEffect } from "react";
import Countdown from "./Countdown";

export default function CalendarAnimeCard({ anime, onRemove }) {
  const isAiring = anime.episode !== null && anime.airingAt !== null;

  // Load watched info from localStorage on every render
  const [watchedState, setWatchedState] = useState(() => {
    try {
      const saved = localStorage.getItem("watchedAnime");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Check if this anime episode is watched (only previous eps)
  const isWatched =
    watchedState[anime.id] && anime.episode <= watchedState[anime.id];

  // Sync watchedState with localStorage whenever it changes (optional, for safety)
  useEffect(() => {
    try {
      localStorage.setItem("watchedAnime", JSON.stringify(watchedState));
    } catch {}
  }, [watchedState]);

  function toggleWatched() {
    setWatchedState((prev) => {
      const currentWatched = prev[anime.id] || 0;
      // If already watched this episode, unwatch it (decrement)
      // else set watched up to this episode
      console.log("anime.episode:", anime.episode);
      console.log("currentWatched:", currentWatched);

      let newWatched;

      if (currentWatched === anime.episode || currentWatched > anime.episode) {
        newWatched = anime.episode - 1;
      } else {
        newWatched = anime.episode;
      }
      console.log("secondWatched:", currentWatched);
      // Build new state
      const updated = { ...prev };
      if (newWatched <= 0) {
        delete updated[anime.id];
      } else {
        updated[anime.id] = newWatched;
      }
      return updated;
    });
  }

  return (
    <div
      title={anime.title.english || anime.title.romaji}
      onDoubleClick={toggleWatched}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        backgroundColor: isWatched 
          ? "#2e2e2e" 
          : anime.favorited 
            ? "#2a2a2a" 
            : "#3a3a3a",
        filter: isWatched ? "grayscale(70%)" : "none",
        borderRadius: 8,
        padding: 8,
        cursor: "default",
        minHeight: 90,
        overflow: "hidden",
        transition: "background-color 0.3s ease, filter 0.3s ease",
        border: anime.favorited ? "2px solid #61dafb" : "none",
        boxShadow: anime.favorited ? "0 0 15px rgba(97, 218, 251, 0.3)" : "none",
      }}
    >
      {/* Top Row: Image + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          className="anime-image-container"
          style={{
            position: "relative",
            width: 40,
            height: 60,
            flexShrink: 0,
            borderRadius: 6,
            overflow: "hidden",
            cursor: "pointer",
            filter: isWatched ? "grayscale(70%)" : "none",
            transition: "filter 0.3s ease",
          }}
        >
          <img
            src={anime.coverImage.extraLarge}
            alt={anime.title.english || anime.title.romaji}
            className="anime-cover-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "opacity 0.3s ease",
            }}
          />
          <button
            className="remove-btn"
            onClick={() => onRemove(anime.id)}
            title="Remove from calendar"
            aria-label={`Remove ${anime.title.english || anime.title.romaji} from calendar`}
          >
            🗑
          </button>
        </div>

        <div
          style={{
            fontWeight: "700",
            fontSize: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flexGrow: 1,
            minWidth: 0,
            color: isWatched ? "#888" : "#eee",
            transition: "color 0.3s ease",
          }}
        >
          {anime.title.english || anime.title.romaji}
        </div>
      </div>

      {/* Bottom Row: Ep + Countdown */}
      {isAiring && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: isWatched ? "#888" : "#ccc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            paddingLeft: 2,
            paddingRight: 2,
            transition: "color 0.3s ease",
          }}
        >
          <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            Ep {anime.episode}
          </div>
          <div
            style={{
              minWidth: 0,
              maxWidth: "70%",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              textAlign: "right",
              color: isWatched ? "#666" : "#aaa",
              transition: "color 0.3s ease",
            }}
          >
            <Countdown airingAt={anime.airingAt} />
          </div>
        </div>
      )}
    </div>
  );
}
