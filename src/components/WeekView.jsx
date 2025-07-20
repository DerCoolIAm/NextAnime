import React from "react";
import DayColumn from "./DayColumn";

export default function WeekView({ weekDates, animeByDate, onRemove, isCurrentWeek }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        height: "calc(80vh - 80px)",
        overflowY: "hidden",
        overflowX: "auto",
        userSelect: "none",
        paddingLeft: 10,
        paddingRight: 10,
        justifyContent: "center",
      }}
    >
      {weekDates.map((date) => {
        const key = date.toISOString();
        const animesForDay = animeByDate[key] || [];

        return (
          <DayColumn 
            key={key} 
            date={date} 
            animes={animesForDay} 
            onRemove={onRemove}
            isCurrentWeek={isCurrentWeek}
          />
        );
      })}
    </div>
  );
}