import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loadCalendarList, saveCalendarList } from "../utils/storage";
import WeekNavigation from "../components/WeekNavigation";
import WeekView from "../components/WeekView";

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getWeekDates(startDate) {
  const week = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(startDate, i));
  }
  return week;
}

function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6);
  const options = { month: 'short', day: 'numeric' };

  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.toLocaleDateString('en-US', { month: 'short' })} ${startDate.getDate()} - ${endDate.getDate()}, ${endDate.getFullYear()}`;
  } else {
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}, ${endDate.getFullYear()}`;
  }
}

export default function Calendar() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);
  const [calendarList, setCalendarList] = useState(() => loadCalendarList());
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAll, setShowAll] = useState(() => {
    const saved = localStorage.getItem("showAllEpisodes");
    return saved === "true";
  });

  useEffect(() => {
    saveCalendarList(calendarList);
  }, [calendarList]);

  useEffect(() => {
    document.body.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflowY = '';
    };
  }, []);

  // Filter calendarList based on showAll toggle
  const filteredCalendarList = React.useMemo(() => {
    if (showAll) {
      return calendarList;
    }
    // Only next upcoming episode per anime
    const now = Date.now();
    const nextEpisodesMap = new Map();

    calendarList.forEach((ep) => {
      if (!ep.airingAt) return;

      const airingMs = ep.airingAt * 1000;
      if (airingMs < now) return;

      const existing = nextEpisodesMap.get(ep.id);
      if (!existing || airingMs < existing.airingAt * 1000) {
        nextEpisodesMap.set(ep.id, ep);
      }
    });

    return Array.from(nextEpisodesMap.values());
  }, [calendarList, showAll]);

  // Group anime by date key and calculate totals
  const animeByDate = {};
  let totalEpisodesThisWeek = 0;

  const weekStart = startDate;
  const weekEnd = addDays(startDate, 6);
  weekEnd.setHours(23, 59, 59, 999);

  filteredCalendarList.forEach((anime) => {
    if (!anime.airingAt) return;
    const airingDate = new Date(anime.airingAt * 1000);
    airingDate.setHours(0, 0, 0, 0);

    if (airingDate >= weekStart && airingDate <= weekEnd) {
      totalEpisodesThisWeek++;
      const key = airingDate.toISOString();
      if (!animeByDate[key]) animeByDate[key] = [];
      animeByDate[key].push(anime);
    }
  });

  // Sort animes by favorite status first, then by airingAt ascending for each day
  Object.keys(animeByDate).forEach((key) => {
    animeByDate[key].sort((a, b) => {
      // First, sort by favorite status (favorites first)
      if (a.favorited && !b.favorited) return -1;
      if (!a.favorited && b.favorited) return 1;
      
      // Then, within each group (favorites and non-favorites), sort by airing time
      return a.airingAt - b.airingAt;
    });
  });

  const weekDates = getWeekDates(startDate);

  function handleRemoveFromCalendar(id) {
    setCalendarList((prev) => prev.filter((a) => a.id !== id));
  }

  // Navigation handlers
  function handlePrevWeek() {
    setStartDate((prev) => addDays(prev, -7));
    setWeekOffset((prev) => prev - 1);
  }

  function handleNextWeek() {
    setStartDate((prev) => addDays(prev, 7));
    setWeekOffset((prev) => prev + 1);
  }

  function handlePrevDay() {
    setStartDate((prev) => addDays(prev, -1));
    const newStartDate = addDays(startDate, -1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((newStartDate - today) / (1000 * 60 * 60 * 24));
    setWeekOffset(Math.floor(daysDiff / 7));
  }

  function handleNextDay() {
    setStartDate((prev) => addDays(prev, 1));
    const newStartDate = addDays(startDate, 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((newStartDate - today) / (1000 * 60 * 60 * 24));
    setWeekOffset(Math.floor(daysDiff / 7));
  }

  function handleToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
    setWeekOffset(0);
  }

  const isCurrentWeek = weekOffset === 0;
  const weekRangeText = formatWeekRange(startDate);

  return (
    <div
      style={{
        width: 1400,
        margin: "40px auto",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        color: "#eee",
        padding: "20px",
        paddingBottom: "10px",
        backgroundColor: "#121212",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
        minHeight: "80vh",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ fontWeight: "700", fontSize: "1.6rem", margin: 0 }}>
            📅 Weekly Anime Schedule
          </h2>
          <p style={{ margin: "8px 0 0 0", fontSize: "1rem", color: "#ccc" }}>
            {weekRangeText}
            {isCurrentWeek && (
              <span style={{ color: "#61dafb", fontWeight: "bold" }}> (Today)</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <div
            style={{
              backgroundColor: "#282828",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Total Episodes This Week:{" "}
            <span style={{ color: "#61dafb" }}>{totalEpisodesThisWeek}</span>
          </div>

          <button
            onClick={() => {
              setShowAll((prev) => {
                const next = !prev;
                localStorage.setItem("showAllEpisodes", next);
                return next;
                });
               }}
            style={{
              backgroundColor: showAll ? "#4caf50" : "#888",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: "700",
              color: "#fff",
            }}
            title="Toggle showing all episodes or only next upcoming"
          >
            {showAll ? "Show Only Next Episodes" : "Show All Episodes"}
          </button>

          <button
            onClick={() => navigate(-1)}
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
            ← Back
          </button>
        </div>
      </header>

      <WeekNavigation
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
        currentStartDate={startDate}
        weekOffset={weekOffset}
        isCurrentWeek={isCurrentWeek}
      />

      <div
        ref={calendarRef}
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <WeekView
          weekDates={weekDates}
          animeByDate={animeByDate}
          onRemove={handleRemoveFromCalendar}
          isCurrentWeek={isCurrentWeek}
        />
      </div>

      {/* Delete button fade animation styles */}
      <style>{`
        .anime-image-container {
          position: relative;
        }

        .anime-image-container .remove-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(255, 0, 0, 0.85);
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          color: white;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .anime-image-container:hover .remove-btn,
        .anime-image-container .remove-btn:hover {
          opacity: 1;
        }

        .anime-image-container:hover .anime-cover-image {
          opacity: 0.4;
        }
      `}</style>

    </div>
  );
}
