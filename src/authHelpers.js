// src/authHelpers.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export async function signupWithUsername(email, password, username) {
  // Check for duplicate username
  const q = query(collection(db, "users"), where("username", "==", username));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    throw new Error("Username already taken.");
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Save username to Firestore
  await setDoc(doc(db, "users", user.uid), {
    email,
    username,
  });

  return user;
}

export async function loginWithUsername(username, password) {
  // Get email from username
  const q = query(collection(db, "users"), where("username", "==", username));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error("Username not found.");
  }

  const userData = snapshot.docs[0].data();
  const email = userData.email;

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}
