import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/** モック (dev) モードで動作中かどうかのフラグ。Firebase 初期化を分岐するのに使う。 */
export const isDevMode = import.meta.env.VITE_APP_MODE === "mock";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// dev (mock) モードは Firebase を初期化しないため、auth は本番モードでのみ実体を持つ。
let auth: Auth | undefined;

if (!isDevMode) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

/**
 * 初期化済みの Firebase Auth を返す。
 * @throws dev (mock) モードは Firebase Auth を使わないため、未初期化で呼ばれた場合。
 */
export function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase auth is not initialized; dev (mock) mode does not use Firebase auth");
  }
  return auth;
}
