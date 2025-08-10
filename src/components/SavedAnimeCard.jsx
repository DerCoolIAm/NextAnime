import React, { useEffect, useState } from "react";

export default function SavedAnimeCard({
  anime,
  onDelete,
  onToggleFavorite,
  onToggleCalendar,
  calendarList,
}) {
  const [countdown, setCountdown] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update countdown timer every second
  useEffect(() => {
    if (!anime.airingAt) {
      setCountdown("");
      return;
    }

    function updateCountdown() {
      const now = Date.now();
      const airingTime = anime.airingAt * 1000;
      const diffMs = airingTime - now;

      if (diffMs <= 0) {
        setCountdown("Now airing");
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diffMs / (1000 * 60)) % 60);
      const secs = Math.floor((diffMs / 1000) % 60);

      let parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0) parts.push(`${mins}m`);
      if (secs > 0 && days === 0) parts.push(`${secs}s`);

      setCountdown(parts.join(" ") || "Less than a second");
    }

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [anime.airingAt]);

  // Auto-refresh view after episode airs
  useEffect(() => {
    if (!anime.airingAt) return;

    const now = Date.now();
    const airingTime = anime.airingAt * 1000;
    const delay = airingTime - now + 1000; // +1s buffer

    if (delay > 0) {
      const timeout = setTimeout(() => {
        setCurrentTime(Date.now()); // Trigger re-render
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [anime.airingAt]);

  const isAiring = anime.episode !== null && anime.airingAt !== null;
  const airingText = isAiring
    ? `Ep ${anime.episode} - ${countdown}`
    : "Finished airing";

  const isInCalendar = calendarList.some((a) => a.id === anime.id);

  return (
    <div
      style={{
        position: "relative",
        width: 180,
        minWidth: 180,
        height: 440,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: anime.favorited ? "#2a2a2a" : "#1e1e1e",
        border: anime.favorited ? "2px solid #61dafb" : "none",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        color: "#eee",
        userSelect: "none",
        boxShadow: anime.favorited ? "0 0 15px rgba(97, 218, 251, 0.3)" : "none",
      }}
    >
      <img
        src={anime.coverImage.extraLarge}
        alt={anime.title.english || anime.title.romaji}
        style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover" }}
      />
      <div
        style={{
          padding: "10px",
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        <div>
          <h4
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: "1.2em",
              height: "2.4em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              wordBreak: "break-word",
            }}
            title={anime.title.english || anime.title.romaji}
          >
            {anime.title.english || anime.title.romaji}
          </h4>

          <p style={{ fontSize: 12, color: "#ccc", marginTop: 4 }}>
            {airingText}
          </p>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginTop: 8,
              marginBottom: 8,
            }}
          >
            <button
              onClick={() => onToggleFavorite(anime.id)}
              style={{
                backgroundColor: "#61dafb",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
              aria-label={
                anime.favorited ? "Unfavorite anime" : "Favorite anime"
              }
              title={anime.favorited ? "Unfavorite" : "Favorite"}
            >
              {anime.favorited ? "★" : "☆"}
            </button>
            <button
              onClick={() => onDelete(anime.id)}
              style={{
                backgroundColor: "#e55353",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                cursor: "pointer",
                color: "white",
                fontWeight: "bold",
                fontSize: 20,
                lineHeight: 1,
              }}
              aria-label="Delete anime"
              title="Delete"
            >
              ×
            </button>
          </div>

          {isAiring && (
            <button
              onClick={() => onToggleCalendar(anime)}
              style={{
                marginTop: 4,
                fontSize: 12,
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                backgroundColor: isInCalendar ? "#28a745" : "#007acc",
                color: "white",
                cursor: "pointer",
                width: "100%",
                fontWeight: "700",
                userSelect: "none",
                transition: "background-color 0.3s",
              }}
              aria-pressed={isInCalendar}
              title={isInCalendar ? "Remove from calendar" : "Add to calendar"}
            >
              {isInCalendar ? "Added ✓" : "Add to calendar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
