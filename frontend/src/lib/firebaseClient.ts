import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ✅ Firebase config from your .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ✅ Initialize app once (safe for hot reload)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Initialize services
export const storage = getStorage(app);
export const auth = getAuth(app);

// ✅ Automatically sign in anonymously so user can read Storage
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth)
      .then(() => console.log("✅ Signed in anonymously"))
      .catch((err) => console.error("❌ Anonymous sign-in failed:", err));
  } else {
    console.log("👤 Authenticated:", user.uid);
  }
});
