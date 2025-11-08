import admin from 'firebase-admin';
import serviceAccount from './firebase-key.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  

  storageBucket: process.env.FIREBASE_STORAGE_BUCKET // Lee desde el .env
});

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage().bucket();