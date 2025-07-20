import React, { createContext, useState, useEffect } from "react";

export const CalendarContext = createContext();

export const CalendarProvider = ({ children }) => {
  const [calendarList, setCalendarList] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("calendarList");
    if (saved) {
      setCalendarList(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("calendarList", JSON.stringify(calendarList));
  }, [calendarList]);

  const addToCalendar = (anime) => {
    // Prevent duplicates based on anime ID
    if (!calendarList.some((a) => a.id === anime.id)) {
      setCalendarList((prev) => [...prev, anime]);
    }
  };

  return (
    <CalendarContext.Provider value={{ calendarList, addToCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
};
