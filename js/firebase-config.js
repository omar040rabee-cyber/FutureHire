// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBDfGgI7SIf2nHkzta7bisKelgjWr0dqBw",
  authDomain: "futurehire-ddef4.firebaseapp.com",
  projectId: "futurehire-ddef4",
  storageBucket: "futurehire-ddef4.firebasestorage.app",
  messagingSenderId: "734408834610",
  appId: "1:734408834610:web:90601cab4c2e07f1ba462b",
  measurementId: "G-362Y0T4KXT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export instances to use across your application files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);