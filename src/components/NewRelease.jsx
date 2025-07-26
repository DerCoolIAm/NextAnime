import React, { useEffect, useRef } from "react";
import { notifyDiscordBot } from "../DiscordNotifier"; // adjust path if needed

export default function NewRelease({ watchingList }) {
  const notifiedReleases = useRef(new Set());

  // Send a test notification once when the component mounts
  useEffect(() => {
    notifyDiscordBot("🛠️ Test notification from your anime website is working!");
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() / 1000; // current Unix timestamp in seconds

      watchingList.forEach(async (anime) => {
        if (
          anime.nextAiringEpisode &&
          anime.nextAiringEpisode.airingAt <= now &&
          !notifiedReleases.current.has(`${anime.id}-${anime.nextAiringEpisode.episode}`)
        ) {
          notifiedReleases.current.add(`${anime.id}-${anime.nextAiringEpisode.episode}`);

          const title = anime.title.english || anime.title.romaji || "Unknown Anime";

          await notifyDiscordBot(`${title} episode ${anime.nextAiringEpisode.episode} just released!`);
        }
      });
    }, 60 * 1000); // every 60 seconds

    return () => clearInterval(interval);
  }, [watchingList]);

  return null;
}
