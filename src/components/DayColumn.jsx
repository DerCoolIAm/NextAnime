import React from "react";
import CalendarAnimeCard from "./CalendarAnimeCard";

export default function DayColumn({ date, animes, onRemove, isCurrentWeek }) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[date.getDay()];
  const dayNum = date.getDate();
  
  // Check if this is today
  const today = new Date();
  const isToday = isCurrentWeek && 
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  return (
    <div
      style={{
        flex: "0 0 160px",
        maxWidth: 160,
        backgroundColor: isToday ? "#2d4a3e" : "#282828",
        borderRadius: 12,
        padding: 12,
        color: "#eee",
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
        border: isToday ? "2px solid #61dafb" : "none",
        boxShadow: isToday ? "0 0 10px rgba(97, 218, 251, 0.3)" : "none",
      }}
    >
      <div
        style={{
          fontWeight: "700",
          fontSize: 16,
          marginBottom: 12,
          borderBottom: "1px solid #444",
          paddingBottom: 6,
          textAlign: "center",
          flexShrink: 0,
          color: isToday ? "#61dafb" : "#eee",
        }}
      >
        {dayName} {dayNum}
        {isToday && (
          <div style={{ fontSize: "10px", color: "#61dafb", marginTop: 2 }}>
            TODAY
          </div>
        )}
      </div>

      {animes.length === 0 ? (
        <div
          style={{
            fontSize: 14,
            color: "#bbb",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          No episodes scheduled
        </div>
      ) : (
        <div
          style={{
            flexGrow: 1,
            paddingRight: 6,
            scrollbarWidth: "thin",
            scrollbarColor: "#61dafb transparent",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflowY: "auto",
            scrollbarWidth: "none", // hide scrollbar in Firefox
            msOverflowStyle: "none", // hide scrollbar IE/Edge
            maxHeight: "calc(100vh - 250px)",
          }}
          className="anime-list-scroll"
        >
          {animes.map((anime) => (
            <CalendarAnimeCard key={anime.id} anime={anime} onRemove={onRemove} />
          ))}
          
          {/* Episode count for this day */}
          <div
            style={{
              fontSize: "11px",
              color: "#888",
              textAlign: "center",
              marginTop: "auto",
              padding: "6px 0",
              borderTop: animes.length > 0 ? "1px solid #444" : "none",
            }}
          >
            {animes.length} episode{animes.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}