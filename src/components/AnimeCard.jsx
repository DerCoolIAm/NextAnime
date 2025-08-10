// src/components/AnimeCard.jsx
import React, { useState, useEffect } from "react";

export default function AnimeCard({ episode, watchingList, onAddAnime }) {
  const {
    media: { id, title, coverImage, genres, siteUrl },
    episode: epNumber,
    airingAt,
  } = episode;

  const [countdown, setCountdown] = useState("");

  // Check if anime is already in watching list
  const isInWatchingList = watchingList.some((anime) => anime.id === id);

  // Update countdown timer every second
  useEffect(() => {
    if (!airingAt) {
      setCountdown("");
      return;
    }

    function updateCountdown() {
      const now = Date.now();
      const airingTime = airingAt * 1000;
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
  }, [airingAt]);

  const handleAddAnime = async () => {
    if (onAddAnime) {
      await onAddAnime(title.romaji || title.english);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        background: "#232323ff",
        borderRadius: 12,
        boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
        padding: 15,
        alignItems: "center",
        gap: 20,
        transition: "transform 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      key={`${id}-${epNumber}`}
    >
      <a
        href={siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flexShrink: 0,
          borderRadius: 8,
          overflow: "hidden",
          width: 120,
          height: 170,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          display: "block",
        }}
        title={title.romaji}
      >
        <img
          src={coverImage.extraLarge}
          alt={title.romaji}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </a>

      <div style={{ flex: 1 }}>
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: "1.3rem",
            fontWeight: "700",
          }}
        >
          {title.romaji} {title.english ? `(${title.english})` : ""}
        </h3>

        <p
          style={{
            margin: "0 0 10px",
            color: "#aaa",
            fontStyle: "italic",
          }}
        >
          {genres?.join(", ")}
        </p>

        <p style={{ margin: "0 0 6px" }}>
          <strong>Episode:</strong> {epNumber}
        </p>

        <p style={{ margin: "0 0 10px" }}>
          <strong>Release:</strong> {countdown}
        </p>

        <button
          onClick={handleAddAnime}
          disabled={isInWatchingList}
          style={{
            padding: "8px 16px",
            backgroundColor: isInWatchingList ? "#666" : "#6dd6ff",
            color: isInWatchingList ? "#ccc" : "#000",
            fontWeight: "bold",
            border: "none",
            borderRadius: "6px",
            cursor: isInWatchingList ? "default" : "pointer",
            fontSize: "14px",
            transition: "background-color 0.3s ease",
          }}
          title={isInWatchingList ? "Anime already in your list" : "Add to watching list"}
        >
          {isInWatchingList ? "Anime already added" : "Add anime"}
        </button>
      </div>
    </div>
  );
}
