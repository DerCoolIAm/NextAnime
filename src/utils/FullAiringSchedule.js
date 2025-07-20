// FullAiringSchedule.js

import { getCachedSchedule, setCachedSchedule } from "../utils/cacheUtils";

export async function FullAiringSchedule(animeId, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedSchedule(animeId);
    if (cached) {
      console.log("Loaded from cache:", animeId);
      return cached;
    }
  }

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        airingSchedule(perPage: 100) {
          nodes {
            episode
            airingAt
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { id: animeId },
      }),
    });

    const data = await response.json();
    const schedule = data.data?.Media?.airingSchedule?.nodes || [];

    console.log("Fetched from API:", animeId, schedule);
    setCachedSchedule(animeId, schedule);
    return schedule;
  } catch (error) {
    console.error("Error fetching full airing schedule:", error);
    return [];
  }
}
