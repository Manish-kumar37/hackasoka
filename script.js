import * as THREE from 'three';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, updateDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const markersCollection = collection(db, "markers");
const chatCollection = collection(db, "chatMessages");

// THREE.js Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('mapCanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10);
scene.add(light);

// Ground
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x008000 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Add Markers Function
async function addLocationMarker(x, z, name, category) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: getCategoryColor(category) });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, 0.5, z);
    marker.userData = { name, category };

    scene.add(marker);
    await addDoc(markersCollection, { x, z, name, category, status: "pending" });
}

// Category Colors
function getCategoryColor(category) {
    switch (category) {
        case "food": return 0xffa500;
        case "event": return 0x0000ff;
        case "restroom": return 0xffffff;
        case "emergency": return 0xff0000;
        default: return 0x00ff00;
    }
}

// Load Approved Markers
async function loadMarkers() {
    const snapshot = await getDocs(markersCollection);
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === "approved") {
            addLocationMarker(data.x, data.z, data.name, data.category);
        }
    });
}

// Filter Markers
document.getElementById("markerFilter").addEventListener("change", (event) => {
    filterMarkers(event.target.value);
});

function filterMarkers(category) {
    markers.forEach(marker => {
        marker.visible = category === "all" || marker.userData.category === category;
    });
}

// Voice Search
document.getElementById("voiceSearch").addEventListener("click", () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.start();
    recognition.onresult = (event) => {
        const speechText = event.results[0][0].transcript.toLowerCase();
        searchMarkers(speechText);
    };
});

// Live Chat Functionality
async function sendMessage() {
    const message = document.getElementById("chatInput").value;
    if (!message) return;
    await addDoc(chatCollection, { text: message, timestamp: Date.now() });
    document.getElementById("chatInput").value = "";
}

onSnapshot(chatCollection, snapshot => {
    const chatBox = document.getElementById("chatMessages");
    chatBox.innerHTML = "";
    snapshot.forEach(doc => {
        const msg = document.createElement("p");
        msg.textContent = doc.data().text;
        chatBox.appendChild(msg);
    });
});

document.getElementById("sendMessage").addEventListener("click", sendMessage);

// Typing Indicator
const typingRef = doc(db, "typingStatus", "userTyping");

function updateTypingStatus(isTyping) {
    setDoc(typingRef, { typing: isTyping }, { merge: true });
}

document.getElementById("chatInput").addEventListener("input", () => {
    updateTypingStatus(true);
    setTimeout(() => updateTypingStatus(false), 2000);
});

onSnapshot(typingRef, snapshot => {
    const typingIndicator = document.getElementById("typingIndicator");
    typingIndicator.textContent = snapshot.data().typing ? "User is typing..." : "";
});

// AI Chatbot for Event Queries
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY";

async function askAI(question) {
    const response = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: question }]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

document.getElementById("askAI").addEventListener("click", async () => {
    const question = document.getElementById("aiInput").value;
    const response = await askAI(question);
    document.getElementById("aiResponse").textContent = response;
});

// Offline Mode Support
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
        .then(() => console.log("Service Worker Registered"));
}

async function loadMarkersOffline() {
    const savedMarkers = JSON.parse(localStorage.getItem("offlineMarkers")) || [];
    savedMarkers.forEach(m => addLocationMarker(m.x, m.z, m.name, m.category));
}

if (!navigator.onLine) {
    loadMarkersOffline();
}

async function saveMarkersOffline(markers) {
    localStorage.setItem("offlineMarkers", JSON.stringify(markers));
}

async function fetchAndSaveMarkers() {
    const snapshot = await getDocs(markersCollection);
    const allMarkers = snapshot.docs.map(doc => doc.data());
    saveMarkersOffline(allMarkers);
}

fetchAndSaveMarkers();
