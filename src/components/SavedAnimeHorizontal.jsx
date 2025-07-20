import React from "react";
import SavedAnimeCard from "./SavedAnimeCard";

export default function SavedAnimeHorizontal({
  watchingList,
  onDelete,
  onToggleFavorite,
  calendarList,        // new prop
  onToggleCalendar,    // new prop
}) {
  if (watchingList.length === 0) return null;

  return (
    <div
      className="anime-scroll-container"
      style={{
        display: "flex",
        overflowX: "auto",
        gap: 16,
        paddingBottom: 10,
        marginBottom: 40,
        maxWidth: 1200,
        paddingLeft: 20,
        paddingRight: 20,
      }}
    >
      {watchingList.map((anime) => (
        <SavedAnimeCard
        key={anime.id}
        anime={anime}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        onToggleCalendar={onToggleCalendar}  // Pass toggle function
        calendarList={calendarList}          // Pass calendar list
        />
      ))}
    </div>
  );
}
