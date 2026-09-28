import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// The server (see lib/firebaseAdmin.ts) switches to the local Firestore/Auth
// emulators — under a different project entirely — whenever
// FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST are set. The client has
// to make the same switch, or it authenticates against real production
// Firebase while the server verifies against the emulator for a different
// project, and every authenticated API call fails verification silently.
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = useEmulators
  ? {
    apiKey: 'fake-api-key',
    authDomain: 'localhost',
    projectId: 'convoarenadev',
  }
  : {
    apiKey: "AIzaSyCJ8Tg39Q7e7765GEC_QtjeuUs9U1pHgsI",
    authDomain: "traust-491612.firebaseapp.com",
    databaseURL: "https://traust-491612-default-rtdb.firebaseio.com",
    projectId: "traust-491612",
    storageBucket: "traust-491612.firebasestorage.app",
    messagingSenderId: "982548588385",
    appId: "1:982548588385:web:ddca77bbcf01ea8c184720",
    measurementId: "G-GMHWWLDEBL"
  };

const alreadyInitialized = getApps().length > 0
const app = alreadyInitialized ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Fast Refresh re-runs this module without resetting the underlying Auth/
// Firestore instances, and connecting an already-connected emulator throws —
// only connect on the app's first real initialization.
if (useEmulators && !alreadyInitialized) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
