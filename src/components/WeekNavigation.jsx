import React from "react";

export default function WeekNavigation({
  onPrevWeek,
  onNextWeek,
  onPrevDay,
  onNextDay,
  onToday,
  currentStartDate,
  weekOffset,
  isCurrentWeek,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onPrevWeek}
          aria-label="Previous Week"
          title="Go back 7 days"
          style={{
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#333",
            fontSize: "14px",
          }}
        >
          «
        </button>
        <button
          onClick={onPrevDay}
          aria-label="Previous Day"
          title="Go back 1 day"
          style={{
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#333",
          }}
        >
          ←
        </button>
      </div>

      <button
        onClick={onToday}
        aria-label="Today"
        title="Go to current day"
        style={{
          backgroundColor: isCurrentWeek ? "#28a745" : "#61dafb",
          border: "none",
          borderRadius: 6,
          padding: "10px 16px",
          cursor: "pointer",
          fontWeight: "700",
          color: "#333",
          fontSize: "14px",
          transition: "background-color 0.3s",
        }}
      >
        🔵 Today
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onNextDay}
          aria-label="Next Day"
          title="Go forward 1 day"
          style={{
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#333",
          }}
        >
          →
        </button>
        <button
          onClick={onNextWeek}
          aria-label="Next Week"
          title="Go forward 7 days"
          style={{
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "8px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#333",
            fontSize: "14px",
          }}
        >
          »
        </button>
      </div>

      {/* Removed week offset indicator */}
    </div>
  );
}
