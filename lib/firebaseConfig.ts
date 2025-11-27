// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // ← Add this import

// Your web app's Firebase configuration
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

// Initialize Firebase services
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // ← Initialize storage

// Export the services
export { app, analytics, auth, db, storage }; // ← Now exporting storage