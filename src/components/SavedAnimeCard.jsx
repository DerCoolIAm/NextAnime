import React, { useEffect, useState } from "react";

export default function SavedAnimeCard({
  anime,
  onDelete,
  onToggleFavorite,
  onToggleCalendar,
  calendarList,
  isCompleted,
}) {
  const [countdown, setCountdown] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update countdown timer every second (only for non-completed anime)
  useEffect(() => {
    if (isCompleted || !anime.airingAt) {
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
  }, [anime.airingAt, isCompleted]);

  // Auto-refresh view after episode airs (only for non-completed anime)
  useEffect(() => {
    if (isCompleted || !anime.airingAt) return;

    const now = Date.now();
    const airingTime = anime.airingAt * 1000;
    const delay = airingTime - now + 1000; // +1s buffer

    if (delay > 0) {
      const timeout = setTimeout(() => {
        setCurrentTime(Date.now()); // Trigger re-render
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [anime.airingAt, isCompleted]);

  const isAiring = !isCompleted && anime.episode !== null && anime.airingAt !== null;
  const airingText = isCompleted
    ? "✅ Completed"
    : isAiring
    ? `Ep ${anime.episode} - ${countdown}`
    : "Finished airing";

  const isInCalendar = calendarList.some((a) => a.id === anime.id);

  return (
    <div
      style={{
        position: "relative",
        width: "clamp(160px, 25vw, 200px)",
        minWidth: "clamp(160px, 25vw, 200px)",
        height: "clamp(380px, 60vw, 460px)",
        borderRadius: "clamp(8px, 1.5vw, 12px)",
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
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-5px)";
        e.currentTarget.style.boxShadow = anime.favorited 
          ? "0 8px 25px rgba(97, 218, 251, 0.4)" 
          : "0 8px 25px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = anime.favorited 
          ? "0 0 15px rgba(97, 218, 251, 0.3)" 
          : "none";
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
              fontSize: "clamp(12px, 2.5vw, 14px)",
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

          <p style={{ 
            fontSize: "clamp(10px, 2vw, 12px)", 
            color: "#ccc", 
            marginTop: 4 
          }}>
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
                width: "clamp(24px, 4vw, 32px)",
                height: "clamp(24px, 4vw, 32px)",
                cursor: "pointer",
                fontSize: "clamp(14px, 3vw, 18px)",
                lineHeight: 1,
                transition: "all 0.3s ease",
              }}
              aria-label={
                anime.favorited ? "Unfavorite anime" : "Favorite anime"
              }
              title={anime.favorited ? "Unfavorite" : "Favorite"}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {anime.favorited ? "★" : "☆"}
            </button>
            <button
              onClick={() => onDelete(anime.id)}
              style={{
                backgroundColor: "#e55353",
                border: "none",
                borderRadius: "50%",
                width: "clamp(24px, 4vw, 32px)",
                height: "clamp(24px, 4vw, 32px)",
                cursor: "pointer",
                color: "white",
                fontWeight: "bold",
                fontSize: "clamp(16px, 3vw, 20px)",
                lineHeight: 1,
                transition: "all 0.3s ease",
              }}
              aria-label="Delete anime"
              title="Delete"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              ×
            </button>
          </div>

          {isAiring && (
            <button
              onClick={() => onToggleCalendar(anime)}
              style={{
                marginTop: 4,
                fontSize: "clamp(10px, 2vw, 12px)",
                padding: "clamp(4px, 1vw, 6px) clamp(8px, 2vw, 10px)",
                borderRadius: "clamp(4px, 1vw, 6px)",
                border: "none",
                backgroundColor: isInCalendar ? "#28a745" : "#007acc",
                color: "white",
                cursor: "pointer",
                width: "100%",
                fontWeight: "700",
                userSelect: "none",
                transition: "all 0.3s ease",
              }}
              aria-pressed={isInCalendar}
              title={isInCalendar ? "Remove from calendar" : "Add to calendar"}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {isInCalendar ? "Added ✓" : "Add to calendar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
