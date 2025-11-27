// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TEMPORARY: Hardcoded configuration
const firebaseConfig = {
  apiKey: "AIzaSyCW3jtanrUfznwXpbTq9ROMPIcLW6rkIxQ",
  authDomain: "gymschedpro.firebaseapp.com",
  projectId: "gymschedpro",
  storageBucket: "gymschedpro.firebasestorage.app",
  messagingSenderId: "1011497848739",
  appId: "1:1011497848739:web:a603b76efce293a4db1416",
  measurementId: "G-FRW4R05L4S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;