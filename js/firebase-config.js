// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAUwb4-DZmljiF_LE2RMxeuITN2lNLooKg",
  authDomain: "futurehire-d848c.firebaseapp.com",
  projectId: "futurehire-d848c",
  storageBucket: "futurehire-d848c.firebasestorage.app",
  messagingSenderId: "254345155549",
  appId: "1:254345155549:web:de172dcbec288f13239c34",
  measurementId: "G-MZCPM0MGC2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export instances to use across your application files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);