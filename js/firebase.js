import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGr9ouFPqCxvGrjZEF7B9oHHz3Qc6VEGg",
  authDomain: "photobooth-vow-1fe77.firebaseapp.com",
  projectId: "photobooth-vow-1fe77",
  storageBucket: "photobooth-vow-1fe77.firebasestorage.app",
  messagingSenderId: "286806450980",
  appId: "1:286806450980:web:e71d9a011eecbc76e889b1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
