import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Use non-empty placeholder values when env vars are missing so that
// initializeApp / getAuth don't throw "auth/invalid-api-key" during
// module initialisation (they only validate credentials on actual network calls).
// When Firebase vars are absent the app shows the login screen immediately
// and no real Firebase requests are ever made.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "placeholder-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:placeholder",
};

const firebaseApp = initializeApp(firebaseConfig);

// Persistencia offline — singleTab en móvil, multiTab en desktop
const _isMobile =
  typeof navigator !== "undefined"
    ? /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    : false;

export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({
    tabManager: _isMobile ? persistentSingleTabManager({}) : persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
