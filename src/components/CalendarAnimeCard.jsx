import React from "react";
import Countdown from "./Countdown";

export default function CalendarAnimeCard({ anime, onRemove }) {
  const isAiring = anime.episode !== null && anime.airingAt !== null;

  return (
    <div
      title={anime.title.english || anime.title.romaji}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        backgroundColor: "#3a3a3a",
        borderRadius: 8,
        padding: 8,
        cursor: "default",
        minHeight: 90,
        overflow: "hidden",
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
            color: "#ccc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            paddingLeft: 2,
            paddingRight: 2,
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
              color: "#aaa",
            }}
          >
            <Countdown airingAt={anime.airingAt} />
          </div>
        </div>
      )}
    </div>
  );
}
