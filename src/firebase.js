import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// --- REPLACE THIS WITH YOUR OWN FIREBASE CONFIG KEYS ---
// Get these from: console.firebase.google.com -> Project Settings -> General -> Your Apps
const firebaseConfig = {
    apiKey: "AIzaSyAqiFSyzirvssZTSRnvAovbkaISjSTN0gc",
    authDomain: "vaniplayer-a9cec.firebaseapp.com",
    projectId: "vaniplayer-a9cec",
    storageBucket: "vaniplayer-a9cec.firebasestorage.app",
    messagingSenderId: "438057635130",
    appId: "1:438057635130:web:f3deadd9d47257d2649403",
    measurementId: "G-DB321LN74E"
};
// -------------------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/**
 * Saves the user's progress to the Cloud Database.
 * @param {string} userId - The user's ID (e.g. "Suraj")
 * @param {object} data - The progress data { tab, track, time, lastPlayed }
 */
export const saveUserProgress = async (userId, data) => {
    if (!userId) return;
    try {
        const sanitizedId = userId.replace(/[.#$/[\]]/g, '_'); // Firebase keys can't have special chars
        const userRef = ref(db, 'users/' + sanitizedId);
        await set(userRef, data);
        console.log("Cloud Saved:", data);
    } catch (e) {
        console.error("Cloud Save Error:", e);
    }
};

/**
 * Loads the user's progress from the Cloud Database.
 * @param {string} userId - The user's ID
 * @returns {Promise<object|null>} The saved progress or null
 */
export const loadUserProgress = async (userId) => {
    if (!userId) return null;
    try {
        const sanitizedId = userId.replace(/[.#$/[\]]/g, '_');
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${sanitizedId}`));
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return null;
        }
    } catch (e) {
        console.error("Cloud Load Error:", e);
        return null;
    }
};
