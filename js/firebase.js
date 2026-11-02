import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbRFyZRgQA1j9rPpH3J5RLnrKiEqMpnNk",
  authDomain: "pledgebooth.firebaseapp.com",
  projectId: "pledgebooth",
  storageBucket: "pledgebooth.firebasestorage.app",
  messagingSenderId: "107105826061",
  appId: "1:107105826061:web:9062460509c2cdc70b6c44",
  measurementId: "G-R0B27XSD6M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
