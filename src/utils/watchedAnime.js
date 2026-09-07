// Watched episode progress: localStorage + Firestore sync helpers
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "../firebase";
import { loadWatchedAnime, saveWatchedAnime } from "./storage";

const FIRESTORE_FIELD = "firebasewatchedanime";

const db = getFirestore(app);

export { loadWatchedAnime, saveWatchedAnime };

/** Prefer the higher episode progress so watch status only moves forward across devices. */
export function mergeWatchedAnime(localMap, cloudMap) {
  const merged = { ...(localMap || {}) };
  for (const [id, value] of Object.entries(cloudMap || {})) {
    const localVal = Number(merged[id]) || 0;
    const cloudVal = Number(value) || 0;
    const max = Math.max(localVal, cloudVal);
    if (max > 0) {
      merged[id] = max;
    } else {
      delete merged[id];
    }
  }
  for (const [id, value] of Object.entries(merged)) {
    if (!(Number(value) > 0)) {
      delete merged[id];
    }
  }
  return merged;
}

export async function loadFirestoreWatchedAnime(uid) {
  if (!uid) return {};
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data()[FIRESTORE_FIELD] || {};
    }
  } catch (e) {
    console.error("Error loading Firestore watched anime:", e);
  }
  return {};
}

export async function saveFirestoreWatchedAnime(uid, map) {
  if (!uid) return;
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { [FIRESTORE_FIELD]: map || {} }, { merge: true });
  } catch (e) {
    console.error("Error saving Firestore watched anime:", e);
  }
}

/** Merge local + cloud, write both sides, return the merged map. */
export async function syncWatchedAnime(uid) {
  const localMap = loadWatchedAnime();
  if (!uid) return localMap;

  const cloudMap = await loadFirestoreWatchedAnime(uid);
  const merged = mergeWatchedAnime(localMap, cloudMap);
  saveWatchedAnime(merged);
  await saveFirestoreWatchedAnime(uid, merged);
  return merged;
}
