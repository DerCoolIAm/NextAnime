// ... imports remain unchanged
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FullAiringSchedule } from "../utils/FullAiringSchedule";

export default function CacheViewer() {
  const navigate = useNavigate();

  const [watchingList, setWatchingList] = useState(() =>
    JSON.parse(localStorage.getItem("watchingList") || "[]")
  );
  const [calendarList, setCalendarList] = useState(() =>
    JSON.parse(localStorage.getItem("calendarList") || "[]")
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  function deleteAnime(id) {
    const newWatchingList = watchingList.filter((a) => a.id !== id);
    const newCalendarList = calendarList.filter((a) => a.id !== id);

    setWatchingList(newWatchingList);
    setCalendarList(newCalendarList);
    localStorage.setItem("watchingList", JSON.stringify(newWatchingList));
    localStorage.setItem("calendarList", JSON.stringify(newCalendarList));
  }

  function confirmDeleteAll() {
    setShowConfirm(true);
  }
  function cancelDeleteAll() {
    setShowConfirm(false);
  }
  function deleteAll() {
    localStorage.removeItem("watchingList");
    localStorage.removeItem("calendarList");
    setWatchingList([]);
    setCalendarList([]);
    setShowConfirm(false);
  }

  function getEpisodeRange(animeId) {
    const eps = calendarList
      .filter((ep) => ep.id === animeId && typeof ep.episode === "number")
      .map((ep) => ep.episode)
      .sort((a, b) => a - b);
    if (eps.length === 0) return "No cached episodes";
    if (eps.length === 1) return `Cached episode ${eps[0]}`;
    return `Cached episodes ${eps[0]} to ${eps[eps.length - 1]}`;
  }

  async function cacheAllEpisodes() {
  if (watchingList.length === 0) return;
  setLoading(true);

  try {
    let updatedCalendar = [...calendarList];

    for (const anime of watchingList) {
      const existingEpisodes = calendarList.filter((ep) => ep.id === anime.id);
      const existingEpisodeCount = existingEpisodes.length;

      // Fetch the full list of episodes from the API
      console.log(`📡 Fetching episodes for ${anime.title.english || anime.title.romaji}`);
      const fullSchedule = await FullAiringSchedule(anime.id, true);

      if (!fullSchedule || fullSchedule.length === 0) {
        console.warn(`⚠️ No episodes found for ${anime.title.english || anime.title.romaji}`);
        continue;
      }

      const totalEpisodeCount = fullSchedule.length;

      // ✅ Only skip if already fully cached
      if (existingEpisodeCount >= totalEpisodeCount) {
        console.log(`✅ Skipping already fully cached: ${anime.title.english || anime.title.romaji}`);
        continue;
      }

      // Remove previously cached episodes for this anime
      const filteredCalendar = updatedCalendar.filter((ep) => ep.id !== anime.id);

      const mapped = fullSchedule.map((ep) => ({
        id: anime.id,
        title: anime.title,
        coverImage: anime.coverImage,
        episode: ep.episode,
        airingAt: ep.airingAt,
      }));

      updatedCalendar = [...filteredCalendar, ...mapped];

      console.log(`🎯 Cached ${mapped.length} episodes for ${anime.title.english || anime.title.romaji}`);

      await new Promise((res) => setTimeout(res, 300)); // Slight delay to avoid rate limits
    }

    localStorage.setItem("calendarList", JSON.stringify(updatedCalendar));
    setCalendarList(updatedCalendar);

    console.log("🎉 All episodes cached and saved");
  } catch (error) {
    console.error("❌ Error caching episodes:", error);
    alert("Failed to cache episodes. Check console for details.");
  } finally {
    setLoading(false);
  }
}

  // UI

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "#eee",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            backgroundColor: "#282828",
            color: "#61dafb",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: "700",
            fontSize: 14,
            userSelect: "none",
            boxShadow: "0 0 8px #61dafb",
            flexShrink: 0,
          }}
          aria-label="Go back"
          title="Back"
        >
          ← Back
        </button>

        <h2 style={{ color: "#61dafb", margin: "0 auto", flexGrow: 1, textAlign: "center" }}>
          📦 Local Cache Viewer
        </h2>

        <button
          onClick={cacheAllEpisodes}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#555" : "#61dafb",
            color: loading ? "#999" : "#333",
            fontWeight: "700",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: loading ? "default" : "pointer",
            userSelect: "none",
            fontSize: 14,
            boxShadow: loading ? "none" : "0 0 8px #61dafb",
            flexShrink: 0,
          }}
          aria-label="Cache all episodes"
          title="Cache all episodes"
        >
          {loading ? "Caching..." : "📦 Cache All Episodes"}
        </button>

        <button
          onClick={confirmDeleteAll}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#555" : "rgba(255, 69, 58, 0.85)",
            color: loading ? "#999" : "white",
            fontWeight: "700",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: loading ? "default" : "pointer",
            userSelect: "none",
            fontSize: 14,
            boxShadow: loading ? "none" : "0 0 8px rgba(255,69,58,0.9)",
            flexShrink: 0,
            marginLeft: 8,
          }}
          aria-label="Delete all cached data"
          title="Delete all cached data"
        >
          Delete All Cache
        </button>
      </div>

      {/* Anime grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
          gap: 20,
          maxHeight: "80vh",
          overflowY: "auto",
          paddingRight: 10,
          scrollbarWidth: "thin",
          scrollbarColor: "#61dafb transparent",
        }}
      >
        {watchingList.length === 0 && (
          <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "#bbb" }}>
            No cached anime found in watching list.
          </p>
        )}

        {watchingList.map((anime) => (
          <div
            key={anime.id}
            style={{
              backgroundColor: "#282828",
              borderRadius: 12,
              padding: 15,
              display: "flex",
              gap: 12,
              alignItems: "center",
              boxShadow: "0 0 10px rgba(0,0,0,0.7)",
              position: "relative",
            }}
          >
            {/* Cover Image */}
            <img
              src={anime.coverImage?.extraLarge || anime.coverImage?.medium}
              alt={anime.title.english || anime.title.romaji}
              style={{
                width: 80,
                height: 120,
                objectFit: "cover",
                borderRadius: 8,
                flexShrink: 0,
                boxShadow: "0 0 8px #61dafb",
              }}
              loading="lazy"
            />

            {/* Text Info */}
            <div
              style={{
                flexGrow: 1,
                color: "#eee",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontWeight: "700",
                  fontSize: 16,
                  marginBottom: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={anime.title.english || anime.title.romaji}
              >
                {anime.title.english || anime.title.romaji}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: "#aaa",
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={getEpisodeRange(anime.id)}
              >
                {getEpisodeRange(anime.id)}
              </div>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => deleteAnime(anime.id)}
              aria-label={`Delete ${anime.title.english || anime.title.romaji} from cache`}
              title="Delete from cache"
              disabled={loading}
              style={{
                backgroundColor: "rgba(255, 69, 58, 0.85)",
                border: "none",
                color: "white",
                fontWeight: "700",
                borderRadius: "50%",
                width: 28,
                height: 28,
                cursor: loading ? "default" : "pointer",
                userSelect: "none",
                boxShadow: "0 0 5px rgba(255,69,58,0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: 18,
                lineHeight: 1,
                transition: "background-color 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = loading ? "rgba(255, 69, 58, 0.85)" : "rgba(255, 69, 58, 1)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 69, 58, 0.85)")}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Popup */}
      {showConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: 20,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              backgroundColor: "#282828",
              borderRadius: 12,
              padding: 30,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 0 30px rgba(97,218,251,0.8)",
              color: "#eee",
              textAlign: "center",
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
          >
            <h3 style={{ marginBottom: 20 }}>⚠️ Confirm Delete All Cache</h3>
            <p style={{ marginBottom: 30 }}>
              Are you sure you want to delete <strong>all cached data</strong>? This action
              cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "space-around" }}>
              <button
                onClick={deleteAll}
                style={{
                  backgroundColor: "#61dafb",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: "700",
                  cursor: "pointer",
                  color: "#333",
                  minWidth: 100,
                }}
              >
                Yes, Delete All
              </button>

              <button
                onClick={cancelDeleteAll}
                style={{
                  backgroundColor: "rgba(255, 69, 58, 0.85)",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: "700",
                  cursor: "pointer",
                  color: "#fff",
                  minWidth: 100,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollbar styles */}
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background-color: #61dafb;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
