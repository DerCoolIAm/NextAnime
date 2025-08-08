import React, { useEffect, useRef } from "react";
import { notifyDiscordBot } from "../utils/DiscordNotifier";

export default function NewRelease({ watchingList }) {
  const notifiedReleases = useRef(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("notifiedReleases");
    if (saved) {
      try {
        notifiedReleases.current = new Set(JSON.parse(saved));
      } catch {
        notifiedReleases.current = new Set();
      }
    }

    const testing = false; // ← Change to true to enable test anime

    const testAnime = {
      id: 999992,
      title: { english: "Test Anime", romaji: "Test Anime" },
      coverImage: {
        extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx178754-Dgrub8xgC03M.jpg",
      },
      nextAiringEpisode: {
        episode: 999,
        airingAt: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
      },
    };

    if (testing) console.log("✅ Test anime injected");

    const listToCheck = testing ? [testAnime, ...watchingList] : watchingList;

    async function checkReleases() {
      console.log("🔍 Checking releases...");
      const now = Math.floor(Date.now() / 1000);
      let newReleasesFound = false;

      for (const anime of listToCheck) {
        if (!anime.nextAiringEpisode) continue;

        const ep = anime.nextAiringEpisode.episode;
        const airingAt = anime.nextAiringEpisode.airingAt;
        if (!ep || !airingAt) continue;

        const episodeKey = `${anime.id}-${ep}`;
        const timeSinceAiring = now - airingAt;

        if (
          timeSinceAiring >= 60 &&
          timeSinceAiring < 600 &&
          !notifiedReleases.current.has(episodeKey)
        ) {
          notifiedReleases.current.add(episodeKey);
          localStorage.setItem(
            "notifiedReleases",
            JSON.stringify([...notifiedReleases.current])
          );

          const title = anime.title.english || anime.title.romaji || "Unknown Anime";
          const imageUrl = anime.coverImage?.extraLarge || null;

          console.log(`📣 Notifying Discord about ${title} episode ${ep}`);
          await notifyDiscordBot(`${title} episode ${ep} just released!`, imageUrl);

          newReleasesFound = true;
        }
      }

      if (!newReleasesFound) {
        console.log("ℹ️ No new releases at this time.");
      }
    }

    // checkReleases(); // Initial check
    const interval = setInterval(checkReleases, 60 * 1000); // Every 60s
    return () => clearInterval(interval);
  }, [watchingList]);

  return null;
}
