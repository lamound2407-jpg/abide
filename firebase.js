// Firebase initialization for Abide.
// Values come from environment variables (see .env.example) so real keys
// never get committed to GitHub.
//
// Setup (one-time):
//   1. https://console.firebase.google.com -> Add project -> "abide"
//   2. Build > Authentication -> enable Email/Password (and/or Google)
//   3. Build > Firestore Database -> Create database (production mode, nearest region)
//   4. Project settings > General > "Your apps" > Add app > Web -> copy the config
//   5. Copy .env.example to .env.local and paste each value in
//   6. npm install && npm run dev

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
