import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig =  {
 apiKey: "AIzaSyBRkYfri2Uy3qdy3emGHHKz6qpDU8fO_1w",
 authDomain: "convoarena-assistant.firebaseapp.com",
 projectId: "convoarena-assistant",
 storageBucket: "convoarena-assistant.firebasestorage.app",
 messagingSenderId: "173430569358",
 appId: "1:173430569358:web:304ef1b6d9fc912b2fccdf",
 measurementId: "G-5RDYQ4QMB2"
};


const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
