// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvOjjYfxBFHW1Bh5omSbwnXo-NJHpqnFI",
  authDomain: "headstartcoding-repl.firebaseapp.com",
  databaseURL: "https://headstartcoding-repl-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "headstartcoding-repl",
  storageBucket: "headstartcoding-repl.firebasestorage.app",
  messagingSenderId: "517892522539",
  appId: "1:517892522539:web:a5870d1ec381dde6d9e06e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);