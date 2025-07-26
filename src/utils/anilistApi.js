const API_URL = "https://graphql.anilist.co";

let apiRequestCount = 0;

// Function to get current count (optional if you want to read it externally)
export function getApiRequestCount() {
  return apiRequestCount;
}

async function fetchGraphQL(query, variables = {}) {
  apiRequestCount++;
  console.log(`AniList API requests made: ${apiRequestCount}`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("AniList GraphQL Error Response:", json.errors);
    throw new Error(
      `AniList API error: ${json.errors?.map(e => e.message).join(", ") || res.statusText}`
    );
  }

  return json.data;
}

// Fetch upcoming airing schedules for multiple anime IDs
export async function fetchAiringSchedulesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const query = `
    query ($ids: [Int]) {
      Page(perPage: 50) {
        airingSchedules(mediaId_in: $ids, notYetAired: true, sort: TIME) {
          airingAt
          episode
          media {
            id
            title {
              romaji
              english
            }
            coverImage {
              extraLarge
            }
            siteUrl
            genres
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { ids });
  return data.Page.airingSchedules || [];
}

// Fetch full airing schedule for one anime ID
export async function fetchFullAiringSchedule(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        airingSchedule(notYetAired: false, perPage: 50) {
          nodes {
            episode
            airingAt
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { id: animeId });
  return data.Media?.airingSchedule?.nodes || [];
}

// Search anime by name (autocomplete)
export async function searchAnimeByName(search, limit = 6) {
  if (!search.trim()) return [];
  const query = `
    query ($search: String, $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, type: ANIME) {
          id
          title {
            english
            romaji
          }
          coverImage {
            extraLarge
          }
          genres
          siteUrl
          episodes
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { search: search.trim(), perPage: limit });
  return data.Page.media || [];
}

// Search single anime by exact name
export async function fetchAnimeByName(search) {
  if (!search.trim()) return null;
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
        }
        genres
        siteUrl
        episodes
      }
    }
  `;
  const data = await fetchGraphQL(query, { search: search.trim() });
  return data.Media || null;
}

// Fetch next upcoming airing schedule (for general upcoming list)
export async function fetchNextAiringSchedules(limit = 10) {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        airingSchedules(notYetAired: true, sort: TIME) {
          airingAt
          episode
          media {
            id
            title {
              romaji
              english
            }
            coverImage {
              extraLarge
            }
            genres
            siteUrl
          }
        }
      }
    }
  `;
  const data = await fetchGraphQL(query, { perPage: limit });
  return data.Page.airingSchedules || [];
}

// ✅ Fixed: Removed invalid `sort` from airingSchedule
export async function fetchAnimeWithSchedules(animeId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
        }
        episodes
        nextAiringEpisode {
          episode
          airingAt
        }
        airingSchedule(notYetAired: false, perPage: 50) {
          nodes {
            episode
            airingAt
          }
        }
      }
    }
  `;
  const variables = { id: animeId };
  const data = await fetchGraphQL(query, variables);
  return data?.Media;
}
