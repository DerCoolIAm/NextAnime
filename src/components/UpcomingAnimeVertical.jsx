import React from "react";
import AnimeCard from "./AnimeCard";

export default function UpcomingAnimeVertical({ episodes }) {
  if (!episodes || episodes.length === 0) return <p>No upcoming episodes available.</p>;

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {episodes.map((ep) => (
        <li key={ep.media.id + ep.episode}>
          <AnimeCard episode={ep} />
        </li>
      ))}
    </ul>
  );
}
