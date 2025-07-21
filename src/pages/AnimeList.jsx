import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomDropdown from "../components/CustomDropdown";

const statusOptions = ["Watching", "Paused", "Dropped", "Plan to Watch"];

export default function AnimeList() {
  const navigate = useNavigate();
  const [animeList, setAnimeList] = useState([]);
  const [filter, setFilter] = useState("All");
  const [openDropdown, setOpenDropdown] = useState({});

  useEffect(() => {
    const savedList = JSON.parse(localStorage.getItem("watchingList")) || [];
    const withDefaults = savedList.map((anime) => ({
      ...anime,
      status: anime.status || "Watching",
      watchedEpisodes: anime.watchedEpisodes ?? 0,
      score: anime.score ?? 0,
    }));
    setAnimeList(withDefaults);
  }, []);

  const filteredList = animeList.filter((anime) =>
    filter === "All" ? true : anime.status === filter
  );

  const updateAnime = (id, changes) => {
    const updated = animeList.map((anime) =>
      anime.id === id ? { ...anime, ...changes } : anime
    );
    setAnimeList(updated);
    localStorage.setItem("watchingList", JSON.stringify(updated));
  };

  const toggleDropdown = (animeId, field) => {
    setOpenDropdown((prev) => ({
      ...prev,
      [`${animeId}-${field}`]: !prev[`${animeId}-${field}`],
    }));
  };

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "#1e1e1e",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      {/* Back Button */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            backgroundColor: "#3c3c3c",
            color: "#fff",
            padding: "6px 14px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            marginRight: "auto",
          }}
        >
          ← Back
        </button>
      </div>

      {/* Filter Buttons */}
      <div style={{ marginBottom: 20 }}>
        {["All", ...statusOptions].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              marginRight: 10,
              padding: "6px 12px",
              backgroundColor: filter === status ? "#61dafb" : "#2c2c2c",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              cursor: "pointer",
              boxShadow: filter === status ? "0 0 5px #61dafb" : "none",
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Anime List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filteredList.map((anime) => {
          const maxEps = anime.episodes ?? 0;

          return (
            <div
              key={anime.id}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#2a2a2a",
                padding: 16,
                borderRadius: 10,
                gap: 20,
              }}
            >
              {/* Image + Title */}
              <img
                src={anime.coverImage?.extraLarge}
                alt={anime.title.english || anime.title.romaji}
                style={{ width: 90, height: 125, borderRadius: 8, objectFit: "cover" }}
              />

              <div style={{ flexGrow: 1 }}>
                <div style={{ fontWeight: "bold", fontSize: 18, marginBottom: 6 }}>
                  {anime.title.english || anime.title.romaji}
                </div>
              </div>

              {/* Controls on the right */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginLeft: "auto",
                  width: 90,
                  boxShadow: "0 3px 8px rgba(0,0,0,0.4)",
                  borderRadius: 6,
                  padding: 6,
                  backgroundColor: "#222",
                }}
              >
                {/* Episodes Dropdown */}
                <CustomDropdown
                  label="Watched Eps"
                  value={anime.watchedEpisodes}
                  options={Array.from({ length: maxEps + 1 }, (_, i) => i)}
                  onSelect={(val) => updateAnime(anime.id, { watchedEpisodes: val })}
                  isOpen={!!openDropdown[`${anime.id}-ep`]}
                  toggleOpen={() => toggleDropdown(anime.id, "ep")}
                />

                {/* Score Dropdown */}
                <CustomDropdown
                  label="Score"
                  value={anime.score}
                  options={Array.from({ length: 11 }, (_, i) => i)}
                  onSelect={(val) => updateAnime(anime.id, { score: val })}
                  isOpen={!!openDropdown[`${anime.id}-score`]}
                  toggleOpen={() => toggleDropdown(anime.id, "score")}
                />

                {/* Status Dropdown */}
                <CustomDropdown
                  label="Status"
                  value={anime.status}
                  options={statusOptions}
                  onSelect={(val) => updateAnime(anime.id, { status: val })}
                  isOpen={!!openDropdown[`${anime.id}-status`]}
                  toggleOpen={() => toggleDropdown(anime.id, "status")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
