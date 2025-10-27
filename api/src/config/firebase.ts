import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import serviceAccount from './firebase-key.json' assert { type: 'json' };
// 👇 CAMBIA ESTA LÍNEA: Quita '/env.constants'
import { FIREBASE_STORAGE_BUCKET } from '../constants';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  storageBucket: FIREBASE_STORAGE_BUCKET
});

export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = getStorage().bucket();
export { admin };