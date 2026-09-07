import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { loadWatchingList, saveWatchingList } from "../utils/storage";
import { syncWatchedAnime } from "../utils/watchedAnime";
import { app } from "../firebase";

const auth = getAuth(app);
const db = getFirestore(app);

function mergeAnimeLists(localList, cloudList) {
  const mergedMap = new Map();

  (localList || []).forEach((anime) => {
    mergedMap.set(anime.id, anime);
  });

  (cloudList || []).forEach((anime) => {
    if (!mergedMap.has(anime.id)) {
      mergedMap.set(anime.id, anime);
    }
  });

  return Array.from(mergedMap.values());
}

export default function UserPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [watchingList, setWatchingList] = useState([]);
  const [cloudList, setCloudList] = useState([]);
  const [activeTab, setActiveTab] = useState("personal");
  const [isWatchingListLoaded, setIsWatchingListLoaded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigate("/login");
      return;
    }

    async function fetchUserData() {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // If user document doesn't exist, redirect to set username
          // Don't create default - user must set username during signup
          setUserData({
            email: currentUser.email || "",
            username: null,
          });
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        // Set fallback user data if there's an error
        setUserData({
          email: currentUser.email || "",
          username: null,
        });
      }
    }

    async function fetchWatchingList() {
      const savedList = loadWatchingList() || [];
      let firebaseList = [];

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          firebaseList = data.firebasewatchedlist || data.firebaseWatchingList || [];
        }
      } catch (err) {
        console.error("Error fetching watching list:", err);
      }

      const mergedList = mergeAnimeLists(savedList, firebaseList);
      setWatchingList(mergedList);
      setCloudList(firebaseList);
      // Keep local storage in sync with cloud as soon as page loads.
      saveWatchingList(mergedList);
      setIsWatchingListLoaded(true);
    }

    fetchUserData();
    fetchWatchingList();
    // Keep calendar watched progress synced when visiting profile while logged in
    syncWatchedAnime(currentUser.uid).catch((err) => {
      console.error("Error syncing watched anime:", err);
    });
  }, [navigate]);

  useEffect(() => {
    if (!isWatchingListLoaded) return;

    async function saveToCloud() {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(
          userDocRef,
          { firebasewatchedlist: watchingList },
          { merge: true }
        );
        setCloudList(watchingList);
      } catch (error) {
        console.error("Error saving watching list to cloud:", error);
      }
    }

    saveWatchingList(watchingList);
    saveToCloud();
  }, [watchingList, isWatchingListLoaded]);

  function handleLogoutTab() {
    setActiveTab("logout");
    setShowLogoutConfirm(true);
  }

  function confirmLogout() {
    signOut(auth).then(() => {
      navigate("/login");
    });
  }

  function cancelLogout() {
    setShowLogoutConfirm(false);
    setActiveTab("personal");
  }

  function handleMergeAnime(anime) {
    const updatedCloudList = [...cloudList, anime];
    setCloudList(updatedCloudList);
    setWatchingList((prev) => {
      const alreadyIn = prev.some((a) => a.id === anime.id);
      return alreadyIn ? prev : [...prev, anime];
    });
  }

  async function handleUsernameChange() {
    setUsernameError("");
    const trimmedUsername = newUsername.trim();
    
    if (!trimmedUsername) {
      setUsernameError("Username cannot be empty.");
      return;
    }

    if (trimmedUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }

    if (trimmedUsername.length > 20) {
      setUsernameError("Username must be 20 characters or less.");
      return;
    }

    // Check username format (letters, numbers, underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setUsernameError("Username can only contain letters, numbers, and underscores.");
      return;
    }

    // Check if username is already taken
    try {
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      const usersRef = collection(db, "users");
      const usernameLower = trimmedUsername.toLowerCase();
      const usernameQuery = query(usersRef, where("usernameLower", "==", usernameLower));
      const usernameSnapshot = await getDocs(usernameQuery);
      
      if (!usernameSnapshot.empty) {
        const existingUser = usernameSnapshot.docs[0];
        const currentUser = auth.currentUser;
        // Allow if it's the same user
        if (existingUser.id !== currentUser?.uid) {
          setUsernameError("Username already taken.");
          return;
        }
      }
    } catch (err) {
      console.warn("Could not check username:", err);
      // Continue anyway if permission error
    }

    // Update username
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(
        userDocRef,
        {
          username: trimmedUsername,
          usernameLower: trimmedUsername.toLowerCase(),
        },
        { merge: true }
      );

      setUserData((prev) => ({
        ...prev,
        username: trimmedUsername,
      }));
      setNewUsername("");
      setIsEditingUsername(false);
      setUsernameError("");
    } catch (err) {
      console.error("Error updating username:", err);
      setUsernameError("Failed to update username. Please try again.");
    }
  }

  const missingFromCloud = watchingList.filter(
    (localAnime) => !cloudList.some((cloudAnime) => cloudAnime.id === localAnime.id)
  );

  if (!userData) {
    return (
      <div style={{ padding: 20, color: "#eee", backgroundColor: "#121212", minHeight: "100vh" }}>
        <p>Loading user data...</p>
      </div>
    );
  }

  const tabButtonStyle = (tab) => ({
    padding: "12px 20px",
    cursor: "pointer",
    backgroundColor: activeTab === tab ? "#61dafb" : "transparent",
    color: activeTab === tab ? "#000" : "#61dafb",
    border: "none",
    borderRadius: "6px",
    fontWeight: 700,
    marginBottom: 10,
    width: "100%",
    textAlign: "left",
  });

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1100,
        margin: "20px auto",
        color: "#eee",
        backgroundColor: "#121212",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
        display: "flex",
        gap: 24,
        padding: 16,
        minHeight: "70vh",
      }}
      className="user-container"
    >
      <style>{`
        @media (max-width: 1024px) {
          .user-container { flex-direction: column; gap: 16px; }
          .user-sidebar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .user-back-btn { position: static !important; align-self: flex-end; margin-bottom: 8px; }
        }
        @media (max-width: 600px) {
          .user-sidebar { grid-template-columns: 1fr; }
          .anime-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
      {/* Sidebar Tabs */}
      <div style={{ flex: "0 0 180px" }} className="user-sidebar">
        <button style={tabButtonStyle("personal")} onClick={() => setActiveTab("personal")}>
          Personal Information
        </button>
        <button style={tabButtonStyle("anime")} onClick={() => setActiveTab("anime")}>
          Anime You're Watching
        </button>
        <button style={tabButtonStyle("merge")} onClick={() => setActiveTab("merge")}>
          Merge
        </button>
        <button style={tabButtonStyle("logout")} onClick={handleLogoutTab}>
          Log Out
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#000",
          }}
          className="user-back-btn"
        >
          ← Back to Main
        </button>

        {activeTab === "personal" && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Personal Information</h2>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Username:
              </label>
              {isEditingUsername ? (
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value);
                        setUsernameError("");
                      }}
                      placeholder={userData.username || "Enter username"}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#2a2a2a",
                        color: "#eee",
                        fontSize: 14,
                      }}
                      maxLength={20}
                    />
                    <button
                      onClick={handleUsernameChange}
                      style={{
                        background: "#61dafb",
                        color: "#000",
                        border: "none",
                        borderRadius: 6,
                        padding: "10px 16px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingUsername(false);
                        setNewUsername("");
                        setUsernameError("");
                      }}
                      style={{
                        background: "#444",
                        color: "#eee",
                        border: "none",
                        borderRadius: 6,
                        padding: "10px 16px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {usernameError && (
                    <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 4 }}>{usernameError}</p>
                  )}
                  <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    Username must be 3-20 characters and can only contain letters, numbers, and underscores.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 16 }}>
                    {userData.username || <span style={{ color: "#888", fontStyle: "italic" }}>Not set</span>}
                  </p>
                  <button
                    onClick={() => {
                      setIsEditingUsername(true);
                      setNewUsername(userData.username || "");
                    }}
                    style={{
                      background: "#61dafb",
                      color: "#000",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {userData.username ? "Change" : "Set Username"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Email:
              </label>
              <p style={{ margin: 0, fontSize: 16 }}>{userData.email}</p>
            </div>
          </section>
        )}

        {activeTab === "anime" && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Anime You're Watching</h2>
            {watchingList.length === 0 ? (
              <p>You haven't added any anime yet.</p>
            ) : (
              <div className="anime-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                {watchingList.map((anime) => (
                  <div key={anime.id} style={{ backgroundColor: "#282828", borderRadius: 12, overflow: "hidden" }}>
                    <img
                      src={anime.coverImage?.extraLarge || anime.coverImage}
                      alt={anime.title?.english || anime.title?.romaji || anime.title}
                      style={{ width: "100%", height: 240, objectFit: "cover" }}
                    />
                    <div style={{ padding: 12, fontWeight: "700" }}>
                      {anime.title?.english || anime.title?.romaji || anime.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "merge" && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Merge Local & Cloud Lists</h2>
            <p style={{ marginBottom: 20 }}>
              This will check your anime saved locally on your device and compare it with what’s saved on the cloud.
              If there are any shows you added before creating your account (or while offline), you can add them to your cloud list here to keep them safe.
            </p>

            {missingFromCloud.length === 0 ? (
              <p>All your local anime are already saved in the cloud.</p>
            ) : (
              <div className="anime-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                {missingFromCloud.map((anime) => (
                  <div key={anime.id} style={{ backgroundColor: "#282828", borderRadius: 12, overflow: "hidden" }}>
                    <img
                      src={anime.coverImage?.extraLarge || anime.coverImage}
                      alt={anime.title?.english || anime.title?.romaji || anime.title}
                      style={{ width: "100%", height: 240, objectFit: "cover" }}
                    />
                    <div style={{ padding: 12, fontWeight: "700" }}>
                      {anime.title?.english || anime.title?.romaji || anime.title}
                    </div>
                    <button
                      onClick={() => handleMergeAnime(anime)}
                      style={{
                        backgroundColor: "#61dafb",
                        border: "none",
                        width: "100%",
                        padding: 10,
                        cursor: "pointer",
                        fontWeight: "700",
                        color: "#000",
                      }}
                    >
                      Add to Cloud
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "logout" && showLogoutConfirm && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Log Out</h2>
            <p>Are you sure you want to log out?</p>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={confirmLogout}
                style={{
                  backgroundColor: "#ff453a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: "700",
                  marginRight: 15,
                }}
              >
                Yes, Log Out
              </button>
              <button
                onClick={cancelLogout}
                style={{
                  backgroundColor: "#61dafb",
                  color: "#000",
                  border: "none",
                  borderRadius: 6,
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: "700",
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
