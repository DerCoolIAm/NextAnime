// components/AnimeSearchAutocomplete.jsx
import React, { useState, useEffect, useRef } from "react";
import { searchAnimeByName } from "../utils/anilistApi";

export default function AnimeSearchAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suppressSuggestions, setSuppressSuggestions] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      // If input is cleared (e.g., after adding anime), allow suggestions again on next typing
      setSuppressSuggestions(false);
      return;
    }

    if (suppressSuggestions) {
      // Do not fetch or show suggestions while suppressed
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const results = await searchAnimeByName(value.trim(), 6);
        setSuggestions(results);
        setShowDropdown(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [value, suppressSuggestions]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "400px",
        flexShrink: 1,
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => {
          // User typed: re-enable suggestions
          setSuppressSuggestions(false);
          onChange(e.target.value);
        }}
        placeholder="e.g. Attack on Titan"
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "none",
          width: "100%",
          fontSize: 16,
          backgroundColor: "#1e1e1e",
          color: "#eee",
        }}
        onFocus={() => {
          if (!suppressSuggestions && value.trim()) {
            setShowDropdown(true);
          }
        }}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            width: "100%",
            backgroundColor: "#222",
            color: "#eee",
            borderRadius: "0 0 6px 6px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxHeight: 200,
            overflowY: "auto",
            scrollbarWidth: "none",
            marginTop: 6,
          }}
          className="autocomplete-dropdown"
        >
          {suggestions.map((anime) => (
            <li
              key={anime.id}
              onClick={() => {
                const name = anime.title.english || anime.title.romaji;
                onSelect(name);
                // After selecting, suppress further suggestions until user types or input is cleared
                setSuppressSuggestions(true);
                setShowDropdown(false);
              }}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #333",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#333")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#222")
              }
              onMouseDown={(e) => e.preventDefault()}
            >
              {anime.title.english || anime.title.romaji}
            </li>
          ))}
        </ul>
      )}

      {/* Hide scrollbar for Chrome/Safari */}
      <style>
        {`
          .autocomplete-dropdown::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
    </div>
  );
}
