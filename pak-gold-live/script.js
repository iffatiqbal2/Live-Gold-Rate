// 1. YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyCQlwKzooFmcmYgmHe2ZDUtVq7cLkWIjdI",
    authDomain: "pakgold-6779f.firebaseapp.com",
    projectId: "pakgold-6779f",
    storageBucket: "pakgold-6779f.firebasestorage.app",
    messagingSenderId: "663815550316",
    appId: "1:663815550316:web:1791dce30647b836482f49",
    measurementId: "G-7BD72SD0C5"
};

// 2. INITIALIZE FIREBASE
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// 3. LIVE MARKET DATA & CALCULATOR STATE
let activePurity = 22; 
let currentGoldTola = 482462; // Default Fallback
let currentUsdToPkr = 280.03;

// 4. AUTHENTICATION LOGIC
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        auth.signInWithPopup(provider)
            .then((result) => console.log("User signed in successfully"))
            .catch((error) => alert("Login Error: " + error.message));
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.signOut());
}

auth.onAuthStateChanged((user) => {
    const loginSection = document.getElementById('login-btn');
    const userProfile = document.getElementById('user-profile');
    const userNameDisplay = document.getElementById('user-name');
    const userPhotoDisplay = document.getElementById('user-photo');

    if (user) {
        loginSection.classList.add('hidden');
        userProfile.classList.remove('hidden');
        // Personalize with User's Name and Photo
        userNameDisplay.innerHTML = `<span class="text-slate-500 font-normal">Hello,</span><br>${user.displayName.split(' ')[0]}`;
        userPhotoDisplay.src = user.photoURL;
    } else {
        loginSection.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
});

// 1. Initialize Database
const db = firebase.database();

async function updateLiveRates() {
    const API_KEY = "2208e6b6cd8ee058b6b9a6f4f59164f9";
    const dbRef = db.ref("market_data");

    // Check Firebase first
    dbRef.once("value", async (snapshot) => {
        const savedData = snapshot.val();
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // If data exists and is less than 1 hour old, use it!
        if (savedData && (now - savedData.timestamp < oneHour)) {
            console.log("Using cached rates from Firebase...");
            currentGoldTola = savedData.gold;
            updateUI(savedData.gold, savedData.silver);
            calculateEverything();
        } 
        else {
            // Otherwise, call the expensive API
            console.log("Rates expired. Calling API...");
            fetchNewRates(API_KEY, dbRef);
        }
    });
}

async function fetchNewRates(key, dbRef) {
    const url = `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=PKR&currencies=XAU,XAG`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const goldPerOunce = 1 / data.rates.XAU;
        const silverPerOunce = 1 / data.rates.XAG;
        
        const goldTola = Math.round((goldPerOunce / 31.1035) * 11.6638);
        const silverTola = Math.round((silverPerOunce / 31.1035) * 11.6638);

        // Save to Firebase for the next hour
        dbRef.set({
            gold: goldTola,
            silver: silverTola,
            timestamp: Date.now()
        });

        currentGoldTola = goldTola;
        updateUI(goldTola, silverTola);
        calculateEverything();
    } catch (e) {
        console.error("API failed, using fallback.");
    }
}

function updateUI(g, s) {
    document.getElementById('gold-price-tola').innerText = g.toLocaleString();
    document.getElementById('silver-price-tola').innerText = s.toLocaleString();
}

// 6. CALCULATOR & PURITY LOGIC
function setPurity(k) {
    activePurity = k;
    
    // UI: Remove yellow from all buttons, then add to the clicked one
    document.querySelectorAll('.purity-btn').forEach(btn => {
        btn.classList.remove('bg-yellow-500', 'text-slate-900', 'shadow-lg');
        btn.classList.add('bg-slate-950', 'text-white');
    });

    // Find the button that was clicked and style it
    const clickedBtn = event.currentTarget;
    clickedBtn.classList.remove('bg-slate-950', 'text-white');
    clickedBtn.classList.add('bg-yellow-500', 'text-slate-900', 'shadow-lg');
    
    calculateEverything();
}

function calculateEverything() {
    const weightInput = document.getElementById('calc-weight');
    const unitInput = document.getElementById('calc-unit');
    const makingInput = document.getElementById('making-charges');

    if (!weightInput || !unitInput || !makingInput) return;

    const weight = parseFloat(weightInput.value) || 0;
    const unit = unitInput.value;
    const making = parseFloat(makingInput.value) || 0;

    // Math Logic: 1 Tola = 11.6638 Grams
    let baseRate = (unit === 'tola') ? currentGoldTola : (currentGoldTola / 11.6638);
    let purityMultiplier = activePurity / 24;
    let adjustedRate = baseRate * purityMultiplier;
    
    let basePrice = weight * adjustedRate;
    let makingTotal = (unit === 'tola') ? (weight * making) : ((weight / 11.6638) * making);
    let tax = (basePrice + makingTotal) * 0.03; // Standard 3% Tax
    let finalTotal = basePrice + makingTotal + tax;

    // Update Receipt Display
    document.getElementById('res-base').innerText = "Rs. " + Math.round(basePrice).toLocaleString();
    document.getElementById('res-making').innerText = "Rs. " + Math.round(makingTotal).toLocaleString();
    document.getElementById('res-tax').innerText = "Rs. " + Math.round(tax).toLocaleString();
    document.getElementById('res-total').innerText = "Rs. " + Math.round(finalTotal).toLocaleString();
}

// 7. INITIALIZATION ON PAGE LOAD
window.onload = () => {
    // Set initial UI values
    document.getElementById('gold-price-tola').innerText = currentGoldTola.toLocaleString();
    document.getElementById('silver-price-tola').innerText = "9,425";
    
    updateForexRates();
    calculateEverything();

    // Listen for input changes to update receipt in real-time
    document.getElementById('calc-weight').addEventListener('input', calculateEverything);
    document.getElementById('calc-unit').addEventListener('change', calculateEverything);
    document.getElementById('making-charges').addEventListener('input', calculateEverything);
};