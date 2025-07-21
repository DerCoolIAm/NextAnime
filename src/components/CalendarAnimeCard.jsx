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
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "opacity 0.3s ease",
              display: "block",
            }}
          />
          <button
            onClick={() => onRemove(anime.id)}
            title="Remove from calendar"
            aria-label={`Remove ${anime.title.english || anime.title.romaji} from calendar`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(255, 0, 0, 0.85)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              color: "white",
              fontSize: 18,
              lineHeight: 1,
              cursor: "pointer",
              opacity: 0,
              transition: "opacity 0.3s ease",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
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

      {/* Bottom Row: Ep (left) and Countdown (right) */}
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
            paddingLeft: 2, // 👈 aligns with card edge
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
