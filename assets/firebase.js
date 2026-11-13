import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Admin yeni kullanıcı açarken kendi oturumu kapanmasın diye ikinci bir app örneği
export function secondaryAuth() {
  const sec = getApps().find(a => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  return getAuth(sec);
}
