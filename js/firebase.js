import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3NOU4NVTnCMgY4MKIfs35C8YJmLKnxtU",
  authDomain: "pledge-64ff2.firebaseapp.com",
  projectId: "pledge-64ff2",
  storageBucket: "pledge-64ff2.firebasestorage.app",
  messagingSenderId: "1041161676115",
  appId: "1:1041161676115:web:d2fe2c6986480e08812da6",
  measurementId: "G-GMRNJWF26H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
