// Firebase Authentication (sadece portal ve admin)
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { app } from "./fb.js";
import { firebaseConfig } from "../config.js";

export const auth = getAuth(app);

// Admin yeni kullanıcı açarken kendi oturumu kapanmasın diye ikinci bir app örneği
export function secondaryAuth() {
  const sec = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  return getAuth(sec);
}
