import React, { useState, useEffect } from "react";
import Countdown from "./Countdown";

export default function CalendarAnimeCard({
  anime,
  onRemove,
  watchedUntil = 0,
  onToggleWatched,
}) {
  const isAiring = anime.episode !== null && anime.airingAt !== null;
  const [holdTimer, setHoldTimer] = useState(null);

  // Check if this anime episode is watched (only previous eps)
  const isWatched = watchedUntil > 0 && anime.episode <= watchedUntil;

  function toggleWatched() {
    if (typeof onToggleWatched === "function") {
      onToggleWatched(anime);
      return;
    }
  }

  const handleMouseDown = () => {
    const timer = setTimeout(() => {
      const link = anime.siteUrl || anime.externalLinks?.[0]?.url;
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
      }
    }, 500); // 500ms hold time
    setHoldTimer(timer);
  };

  const handleMouseUp = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
  };

  const handleTouchStart = () => {
    const timer = setTimeout(() => {
      const link = anime.siteUrl || anime.externalLinks?.[0]?.url;
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
      }
    }, 500); // 500ms hold time
    setHoldTimer(timer);
  };

  const handleTouchEnd = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      setHoldTimer(null);
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
      }
    };
  }, [holdTimer]);

  const link = anime.siteUrl || anime.externalLinks?.[0]?.url;

  return (
    <div
      title={`${anime.title.english || anime.title.romaji}${link ? " (Hold to open link)" : ""}`}
      onDoubleClick={toggleWatched}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
        cursor: link ? "pointer" : "default",
        minHeight: 90,
        overflow: "hidden",
        transition: "background-color 0.3s ease, filter 0.3s ease",
        border: anime.favorited ? "2px solid #61dafb" : "none",
        boxShadow: anime.favorited ? "0 0 15px rgba(97, 218, 251, 0.3)" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Top Row: Image + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          className="anime-image-container"
          style={{
            position: "relative",
            width: 36,
            height: 54,
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
            fontSize: 13,
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
          {anime.title?.customTitle || anime.title?.english || anime.title?.romaji || anime.title}
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
              maxWidth: "65%",
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
