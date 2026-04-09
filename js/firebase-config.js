/* ══════════════════════════════════════════════
   NEJstudios — Firebase Configuration
   ══════════════════════════════════════════════

   SETUP INSTRUCTIONS:
   1. Go to https://console.firebase.google.com
   2. Create a new project (or open your existing one)
   3. Add a Web App: Project Settings → General → Your apps → Add app
   4. Copy the firebaseConfig values below
   5. Enable Firestore: Build → Firestore Database → Create database
   6. Enable Anonymous Auth: Build → Authentication → Sign-in method → Anonymous → Enable
   7. Paste your Firestore rules from firestore.rules
   8. Set FIREBASE_ENABLED = true below
   ══════════════════════════════════════════════ */

// ─── Step 1: Replace with your Firebase project config ──────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ─── Step 2: Set this to true after filling in your real config above ────────
const FIREBASE_ENABLED = false;

// ─────────────────────────────────────────────────────────────────────────────

let db   = null;
let auth = null;

if (FIREBASE_ENABLED) {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db   = firebase.firestore();
    auth = firebase.auth();

    // Sign in anonymously so Firestore rules can verify requests are authenticated
    auth.signInAnonymously().catch(err => {
      console.error('[NEJ] Anonymous sign-in failed:', err.message);
    });

    console.log('[NEJ] Firebase connected — Firestore ready');
  } catch (e) {
    console.error('[NEJ] Firebase init failed. Falling back to localStorage.', e);
    db = auth = null;
  }
} else {
  console.warn('[NEJ] Firebase not configured — using localStorage. Set FIREBASE_ENABLED=true in firebase-config.js after adding your config.');
}
