import React from "react";
import AnimeCard from "./AnimeCard";

export default function UpcomingAnimeVertical({ episodes, watchingList, onAddAnime }) {
  if (!episodes || episodes.length === 0) return <p>No upcoming episodes available.</p>;

  return (
    <div>
      <h3
        style={{
          textAlign: "center",
          marginBottom: 20,
          backgroundColor: "#f5f5f5",
          color: "#333",
          padding: "10px 20px",
          borderRadius: 8,
          maxWidth: 300,
          marginLeft: "auto",
          marginRight: "auto",
          fontWeight: 700,
          fontSize: "1.2rem",
        }}
      >
        🎬 Upcoming Anime
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {episodes.map((ep) => (
          <li key={ep.media.id + ep.episode}>
            <AnimeCard 
              episode={ep} 
              watchingList={watchingList}
              onAddAnime={onAddAnime}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
