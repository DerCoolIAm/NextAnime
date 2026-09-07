// src/utils/storage.js

export function loadWatchingList() {
  try {
    const data = localStorage.getItem("watchingList");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveWatchingList(list) {
  localStorage.setItem("watchingList", JSON.stringify(list));
}

// Calendar List

export function loadCalendarList() {
  try {
    const data = localStorage.getItem("calendarList");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCalendarList(list) {
  localStorage.setItem("calendarList", JSON.stringify(list));
}

// Watched episode progress (calendar "watched until" map)
// Prefer src/utils/watchedAnime.js for sync-aware load/save.

export function loadWatchedAnime() {
  try {
    const data = localStorage.getItem("watchedAnime");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveWatchedAnime(map) {
  localStorage.setItem("watchedAnime", JSON.stringify(map || {}));
}
