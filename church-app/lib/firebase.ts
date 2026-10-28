import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB6qwCyo0PqBCSEgLFw87EAhDLik22TboE",
  authDomain: "memenan-137b3.firebaseapp.com",
  projectId: "memenan-137b3",
  storageBucket: "memenan-137b3.appspot.com",
  messagingSenderId: "946172332452",
  appId: "1:946172332452:web:8c9afeff83711a340a5931",
  measurementId: "G-YSXPN6PL3F"
};

// Initialize Firebase securely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Enforce local persistence
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}

export { app, db, auth, storage };
