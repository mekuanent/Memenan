import * as admin from 'firebase-admin';

export function getAdminDb() {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
       console.error("CRITICAL SAFETY BLOCK: Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL in .env.local file. Firebase Admin completely blocked execution to prevent credentials panic.");
       throw new Error("Missing Firebase Admin Keys in .env.local");
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'memenan-137b3',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.firestore();
}
