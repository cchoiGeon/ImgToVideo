import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  type: process.env.A_FIREBASE_TYPE,
  project_id: process.env.B_FIREBASE_PROJECT_ID,
  private_key_id: process.env.C_FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.D_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.E_FIREBASE_CLIENT_EMAIL,
  client_id: process.env.F_FIREBASE_CLIENT_ID,
  auth_uri: process.env.G_FIREBASE_AUTH_URI,
  token_uri: process.env.H_FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.I_FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.J_FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.K_FIREBASE_UNIVERSE_DOMAIN
};

// Firebase Admin SDK 초기화
export const initApp = admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  storageBucket: "imgtovideo-d2153.appspot.com",
});

// Firestore 및 Auth 객체를 내보냄
export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = admin.storage().bucket();
