import React from "react";
import SavedAnimeCard from "./SavedAnimeCard";

export default function SavedAnimeHorizontal({
  watchingList,
  onDelete,
  onToggleFavorite,
  calendarList,
  onToggleCalendar,
  isCompleted,
}) {
  if (watchingList.length === 0) return null;

  const now = Date.now() / 1000;

  // One-time fix: Replace outdated airingAt/episode with next upcoming
  const adjustedList = watchingList.map((anime) => {
    // Skip adjustment for completed anime
    if (anime.status === "FINISHED") {
      return anime;
    }

    if (
      anime.airingAt &&
      anime.airingAt < now &&
      anime.airingSchedule?.nodes
    ) {
      const nextEp = anime.airingSchedule.nodes.find(
        (ep) => ep.airingAt > now
      );
      if (nextEp) {
        return {
          ...anime,
          airingAt: nextEp.airingAt,
          episode: nextEp.episode,
        };
      }
    }
    return anime;
  });

  return (
    <div
      className="anime-scroll-container"
      style={{
        display: "flex",
        overflowX: "auto",
        gap: "clamp(12px, 2vw, 20px)",
        padding: "clamp(10px, 2vw, 20px)",
        marginBottom: "clamp(20px, 4vw, 40px)",
        maxWidth: "100%",
        scrollbarWidth: "thin",
        scrollbarColor: "#61dafb transparent",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {adjustedList.map((anime) => (
        <SavedAnimeCard
          key={anime.id}
          anime={anime}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          onToggleCalendar={onToggleCalendar}
          calendarList={calendarList}
          isCompleted={isCompleted(anime)}
        />
      ))}
    </div>
  );
}
