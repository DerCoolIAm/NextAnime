import React, { useEffect, useRef } from "react";
import { notifyDiscordBot } from "../utils/DiscordNotifier";

export default function NewRelease({ watchingList }) {
  const notifiedReleases = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Checking releases...");
      const now = Date.now() / 1000;

      watchingList.forEach(async (anime) => {
        if (
          anime.nextAiringEpisode &&
          anime.nextAiringEpisode.airingAt <= now &&
          !notifiedReleases.current.has(`${anime.id}-${anime.nextAiringEpisode.episode}`)
        ) {
          notifiedReleases.current.add(`${anime.id}-${anime.nextAiringEpisode.episode}`);

          const title = anime.title.english || anime.title.romaji || "Unknown Anime";

          console.log(`Notifying Discord about ${title}`);
          await notifyDiscordBot(`${title} episode ${anime.nextAiringEpisode.episode} just released!`);
        }
      });
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [watchingList]);

  return null;
}
