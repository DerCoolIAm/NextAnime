import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { loadWatchingList, saveWatchingList } from "../utils/storage";
import { app } from "../firebase";

const auth = getAuth(app);
const db = getFirestore(app);

export default function UserPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [watchingList, setWatchingList] = useState([]);
  const [cloudList, setCloudList] = useState([]);
  const [activeTab, setActiveTab] = useState("personal");
  const [isWatchingListLoaded, setIsWatchingListLoaded] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    }

    async function fetchWatchingList() {
      const savedList = loadWatchingList() || [];
      setWatchingList(savedList);

      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          const firebaseList = data.firebaseWatchingList || [];
          setCloudList(firebaseList);
        }
      } catch (err) {
        console.error("Error fetching watching list:", err);
      }

      setIsWatchingListLoaded(true);
    }

    fetchUserData();
    fetchWatchingList();
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
          { firebaseWatchingList: watchingList },
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
        maxWidth: 900,
        margin: "40px auto",
        color: "#eee",
        backgroundColor: "#121212",
        borderRadius: 12,
        boxShadow: "0 0 20px rgba(0,0,0,0.7)",
        display: "flex",
        gap: 30,
        padding: 20,
        minHeight: "80vh",
      }}
    >
      {/* Sidebar Tabs */}
      <div style={{ flex: "0 0 180px" }}>
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
            position: "fixed",
            top: 10,
            right: 10,
            backgroundColor: "#61dafb",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: "700",
            color: "#000",
          }}
        >
          ← Back to Main
        </button>

        {activeTab === "personal" && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Personal Information</h2>
            <p><strong>Username:</strong> {userData.username}</p>
            <p><strong>Email:</strong> {userData.email}</p>
          </section>
        )}

        {activeTab === "anime" && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ borderBottom: "1px solid #444", paddingBottom: 8 }}>Anime You're Watching</h2>
            {watchingList.length === 0 ? (
              <p>You haven't added any anime yet.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
                {watchingList.map((anime) => (
                  <div key={anime.id} style={{ backgroundColor: "#282828", borderRadius: 12, overflow: "hidden" }}>
                    <img
                      src={anime.coverImage?.extraLarge || anime.coverImage}
                      alt={anime.title?.english || anime.title?.romaji || anime.title}
                      style={{ width: "100%", height: 280, objectFit: "cover" }}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
                {missingFromCloud.map((anime) => (
                  <div key={anime.id} style={{ backgroundColor: "#282828", borderRadius: 12, overflow: "hidden" }}>
                    <img
                      src={anime.coverImage?.extraLarge || anime.coverImage}
                      alt={anime.title?.english || anime.title?.romaji || anime.title}
                      style={{ width: "100%", height: 280, objectFit: "cover" }}
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
