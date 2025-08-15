import React, { useMemo, useState } from "react";

export default function AnimeEditModal({
  anime,
  isOpen,
  onClose,
  onSaveReleaseTimestamp,
  onAdjustOffsetSeconds,
  onResetReleaseTime,
  onToggleFavorite,
  onDelete,
  onToggleCalendar,
  isInCalendar,
  setAnimeList,
}) {
  if (!isOpen || !anime) return null;

  const currentAdjustedTs = anime.airingAt || null; // seconds
  const displayIso = useMemo(() => {
    if (!currentAdjustedTs) return "";
    const d = new Date(currentAdjustedTs * 1000);
    // Format to yyyy-MM-ddTHH:mm for datetime-local
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }, [currentAdjustedTs]);

  const [manualTime, setManualTime] = useState(displayIso);
  const [manualLink, setManualLink] = useState(anime.siteUrl || "");

  React.useEffect(() => {
    setManualTime(displayIso);
  }, [displayIso]);

  React.useEffect(() => {
    setManualLink(anime.siteUrl || "");
  }, [anime.siteUrl]);

  function handleManualSave() {
    if (!manualTime) return;
    const newDate = new Date(manualTime);
    if (isNaN(newDate.getTime())) return;
    const newTsSeconds = Math.floor(newDate.getTime() / 1000);
    onSaveReleaseTimestamp(anime.id, newTsSeconds);
  }

  // Implemented link management functions
  const onSaveLink = (animeId, newLink) => {
    setAnimeList(prevList => 
      prevList.map(animeItem => {
        if (animeItem.id === animeId) {
          // Store the original URL if this is the first time we're modifying it
          const originalSiteUrl = animeItem.originalSiteUrl || animeItem.siteUrl;
          
          return {
            ...animeItem,
            siteUrl: newLink.trim(), // Save the new link (trimmed)
            originalSiteUrl: originalSiteUrl // Keep track of the original
          };
        }
        return animeItem;
      })
    );
    
    console.log(`Link updated for anime ${animeId}`);
  };

  const onResetLink = (animeId) => {
    setAnimeList(prevList => 
      prevList.map(animeItem => {
        if (animeItem.id === animeId && animeItem.originalSiteUrl) {
          return {
            ...animeItem,
            siteUrl: animeItem.originalSiteUrl, // Reset to original
          };
        }
        return animeItem;
      })
    );
    
    console.log(`Link reset to original for anime ${animeId}`);
  };

  function handleLinkSave() {
    onSaveLink(anime.id, manualLink);
  }

  function handleLinkReset() {
    onResetLink(anime.id);
    // Reset the input field to the original value
    setManualLink(anime.originalSiteUrl || anime.siteUrl || "");
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") onClose();
  }

  const isLinkModified = anime.originalSiteUrl && anime.siteUrl !== anime.originalSiteUrl;

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          background: "#1f1f1f",
          color: "#eee",
          borderRadius: 12,
          border: "1px solid rgba(97,218,251,0.25)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, background: "#242424", borderBottom: "1px solid #333" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Edit Anime</div>
          <button onClick={onClose} style={{ background: "transparent", color: "#ccc", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16 }}>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 16 }}>
            <img src={anime.coverImage?.extraLarge || anime.coverImage} alt={anime.title?.english || anime.title?.romaji || anime.title} style={{ width: 90, height: 135, objectFit: "cover", borderRadius: 8 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <label style={{ fontSize: 12, color: "#aaa" }}>Name</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="text" value={anime.title?.english || anime.title?.romaji || anime.title} disabled style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#2a2a2a", color: "#aaa" }} />
                <button disabled style={{ background: "#444", color: "#aaa", border: "none", borderRadius: 6, padding: "8px 10px", cursor: "not-allowed" }}>Reset</button>
              </div>

              <label style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>Link</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input 
                  type="text" 
                  value={manualLink} 
                  onChange={(e) => setManualLink(e.target.value)}
                  placeholder="Enter anime URL..."
                  style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#2a2a2a", color: "#eee" }} 
                />
                <button 
                  onClick={handleLinkSave}
                  style={{ background: "#61dafb", color: "#000", border: "none", borderRadius: 6, padding: "8px 10px", fontWeight: 800, cursor: "pointer" }}
                >
                  Save
                </button>
                <button 
                  onClick={handleLinkReset}
                  disabled={!anime.originalSiteUrl}
                  style={{ 
                    background: anime.originalSiteUrl ? "#444" : "#333", 
                    color: anime.originalSiteUrl ? "#eee" : "#666", 
                    border: "none", 
                    borderRadius: 6, 
                    padding: "8px 10px", 
                    cursor: anime.originalSiteUrl ? "pointer" : "not-allowed" 
                  }}
                >
                  Reset
                </button>
              </div>
              {isLinkModified && (
                <div style={{ fontSize: 12, color: "#ffa726" }}>Link has been modified from original</div>
              )}
              {!anime.originalSiteUrl && (
                <div style={{ fontSize: 12, color: "#aaa" }}>No modifications made</div>
              )}
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, color: "#aaa" }}>Release time</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="datetime-local"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                style={{ flex: 1, minWidth: 240, padding: 10, borderRadius: 6, border: "1px solid #333", background: "#2a2a2a", color: "#eee" }}
              />
              <button onClick={handleManualSave} style={{ background: "#61dafb", color: "#000", border: "none", borderRadius: 6, padding: "10px 12px", fontWeight: 800, cursor: "pointer" }}>Save</button>
              <button onClick={() => onAdjustOffsetSeconds(anime.id, 60 * 60)} style={{ background: "#2e7d32", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}>+1h</button>
              <button onClick={() => onAdjustOffsetSeconds(anime.id, -60 * 60)} style={{ background: "#8b0000", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}>-1h</button>
              <button onClick={() => onAdjustOffsetSeconds(anime.id, 30 * 60)} style={{ background: "#2e7d32", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}>+30m</button>
              <button onClick={() => onAdjustOffsetSeconds(anime.id, -30 * 60)} style={{ background: "#8b0000", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}>-30m</button>
              <button onClick={() => onResetReleaseTime(anime.id)} style={{ background: "#444", color: "#eee", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer", marginLeft: "auto" }}>Reset</button>
            </div>
            {anime.userTimeOffsetSeconds ? (
              <div style={{ fontSize: 12, color: "#aaa" }}>Offset applied: {Math.round(anime.userTimeOffsetSeconds / 60)} minutes</div>
            ) : (
              <div style={{ fontSize: 12, color: "#aaa" }}>No offset applied</div>
            )}
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              onClick={() => onToggleFavorite(anime.id)}
              style={{ background: "#61dafb", color: "#000", border: "none", borderRadius: 6, padding: "10px 12px", fontWeight: 800, cursor: "pointer" }}
            >
              {anime.favorited ? "★ Unfavorite" : "☆ Favorite"}
            </button>
            <button
              onClick={() => onToggleCalendar(anime)}
              style={{ background: isInCalendar ? "#2e7d32" : "#007acc", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}
            >
              {isInCalendar ? "Remove from Calendar" : "Add to Calendar"}
            </button>
            <button
              onClick={() => onDelete(anime.id)}
              style={{ background: "#e55353", color: "#fff", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}