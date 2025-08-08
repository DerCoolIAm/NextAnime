// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBJKEkuWkJdqrTCX-q0mHadR6XbV7-ZmDE",
  authDomain: "nextanime-73e5b.firebaseapp.com",
  projectId: "nextanime-73e5b",
  storageBucket: "nextanime-73e5b.appspot.com",
  messagingSenderId: "586771541612",
  appId: "1:586771541612:web:430d02726346784a15b249",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };