import React, { useEffect, useState } from "react";
import DayColumn from "./DayColumn";

export default function WeekView({ weekDates, animeByDate, onRemove, isCurrentWeek }) {
  const [columns, setColumns] = useState(7);

  useEffect(() => {
    function calcColumns(width) {
      if (width <= 480) return 2; // phones
      if (width <= 768) return 3; // small tablets
      if (width <= 1024) return 4; // tablets
      return 7; // desktop
    }

    function handleResize() {
      setColumns(calcColumns(window.innerWidth));
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isGrid = columns < 7;

  return (
    <div
      style={
        isGrid
          ? {
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, minmax(140px, 1fr))`,
              gap: 10,
              rowGap: 12,
              userSelect: "none",
              paddingLeft: 10,
              paddingRight: 10,
            }
          : {
              display: "flex",
              gap: 10,
              height: "auto",
              overflowY: "hidden",
              overflowX: "auto",
              userSelect: "none",
              paddingLeft: 10,
              paddingRight: 10,
              justifyContent: "center",
              WebkitOverflowScrolling: "touch",
            }
      }
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
            isGrid={isGrid}
            isCurrentWeek={isCurrentWeek}
          />
        );
      })}
    </div>
  );
}