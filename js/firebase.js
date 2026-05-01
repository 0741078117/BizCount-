/* ============================================================
   BIZCOUNT — Firebase Integration
   Handles Authentication + Firestore cloud sync
   
   Project: bizcount-d1064
   ============================================================ */

// ============================================================
// FIREBASE CONFIG
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection,
         addDoc, getDocs, updateDoc, deleteDoc, query,
         where, orderBy, onSnapshot, serverTimestamp, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDW5spPmnVA3m4slJ6LHdLuAcoVCpT3-QM",
  authDomain:        "bizcount-d1064.firebaseapp.com",
  projectId:         "bizcount-d1064",
  storageBucket:     "bizcount-d1064.firebasestorage.app",
  messagingSenderId: "1070911071179",
  appId:             "1:1070911071179:web:c38ece9bf8428b36568c4e",
  measurementId:     "G-607EJQ9G9E"
};

// ============================================================
// INIT
// ============================================================

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

// Current user UID (set after login)
let currentUID = null;

// ============================================================
// HELPERS
// ============================================================

// Build a Firestore path under the user's own folder
// All data is isolated per user: users/{uid}/products, etc.
const userCol = (col) => collection(db, 'users', currentUID, col);
const userDoc = (col, id) => doc(db, 'users', currentUID, col, id);
const profileDoc = () => doc(db, 'users', currentUID);

// Convert phone to a fake email for Firebase Auth
// (Firebase Auth email/password is simplest for PIN-based login)
// Format: 254712345678@bizcount.app
const phoneToEmail = (phone) => {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return `${p}@bizcount.app`;
};

// ============================================================
// FIREBASE AUTH — REGISTER
// ============================================================

async function fbRegister(name, phone, pin) {
  const email    = phoneToEmail(phone);
  const password = pin + phone.replace(/\D/g,'').slice(-4); // PIN + last 4 digits as password

  try {
    showLoadingOverlay('Creating your account...');

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    currentUID = cred.user.uid;

    // Update display name
    await updateProfile(cred.user, { displayName: name });

    // Save profile to Firestore
    await setDoc(profileDoc(), {
      name,
      phone,
      businessName: name,
      createdAt: serverTimestamp(),
      trial: {
        start: new Date().toISOString().slice(0,10),
        paid: false
      },
      settings: {
        rent: 0,
        dailyRentSaving: 0,
        restockFund: 200,
        businessName: name,
        phone
      }
    });

    hideLoadingOverlay();
    return { ok: true, name };

  } catch (e) {
    hideLoadingOverlay();
    if (e.code === 'auth/email-already-in-use') {
      return { ok: false, error: 'This phone number already has an account. Please login.' };
    }
    return { ok: false, error: e.message };
  }
}

// ============================================================
// FIREBASE AUTH — LOGIN
// ============================================================

async function fbLogin(phone, pin) {
  const email    = phoneToEmail(phone);
  const password = pin + phone.replace(/\D/g,'').slice(-4);

  try {
    showLoadingOverlay('Logging in...');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUID = cred.user.uid;
    hideLoadingOverlay();
    return { ok: true };

  } catch (e) {
    hideLoadingOverlay();
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      return { ok: false, error: 'Account not found. Check your number or register.' };
    }
    if (e.code === 'auth/wrong-password') {
      return { ok: false, error: 'Wrong PIN. Please try again.' };
    }
    return { ok: false, error: 'Login failed. Check your internet and try again.' };
  }
}

// ============================================================
// FIREBASE AUTH — LOGOUT
// ============================================================

async function fbLogout() {
  await signOut(auth);
  currentUID = null;
  // Clear local cache
  Object.keys(localStorage).filter(k => k.startsWith('bizcount_')).forEach(k => localStorage.removeItem(k));
}

// ============================================================
// LOAD USER DATA FROM FIRESTORE → LOCAL CACHE
// Called once after login so app works offline too
// ============================================================

async function loadUserDataFromCloud() {
  if (!currentUID) return;

  showLoadingOverlay('Loading your business data...');

  try {
    // Load profile + settings
    const profileSnap = await getDoc(profileDoc());
    if (profileSnap.exists()) {
      const profile = profileSnap.data();
      DB.set('user', { name: profile.name, phone: profile.phone, pin: '****' });
      if (profile.settings) DB.set('settings', profile.settings);
      if (profile.trial)    DB.set('trial',    profile.trial);
    }

    // Load products
    const productsSnap = await getDocs(userCol('products'));
    const products = [];
    productsSnap.forEach(d => products.push({ id: d.id, ...d.data() }));
    DB.set('products', products);

    // Load sales
    const salesSnap = await getDocs(query(userCol('sales'), orderBy('createdAt', 'desc')));
    const sales = [];
    salesSnap.forEach(d => sales.push({ id: d.id, ...d.data() }));
    DB.set('sales', sales);

    // Load debts
    const debtsSnap = await getDocs(userCol('debts'));
    const debts = [];
    debtsSnap.forEach(d => debts.push({ id: d.id, ...d.data() }));
    DB.set('debts', debts);

    // Load expenses
    const expensesSnap = await getDocs(query(userCol('expenses'), orderBy('createdAt', 'desc')));
    const expenses = [];
    expensesSnap.forEach(d => expenses.push({ id: d.id, ...d.data() }));
    DB.set('expenses', expenses);

    // Load withdrawals
    const withdrawalsSnap = await getDocs(userCol('withdrawals'));
    const withdrawals = [];
    withdrawalsSnap.forEach(d => withdrawals.push({ id: d.id, ...d.data() }));
    DB.set('withdrawals', withdrawals);

    // Load daily savings
    const savingsSnap = await getDocs(userCol('daily_savings'));
    const savings = [];
    savingsSnap.forEach(d => savings.push({ id: d.id, ...d.data() }));
    DB.set('daily_savings', savings);

    hideLoadingOverlay();
    return true;

  } catch (e) {
    console.error('[Firebase] Load error:', e);
    hideLoadingOverlay();
    showToast('Using offline data. Check your internet.', 'info');
    return false;
  }
}

// ============================================================
// FIRESTORE SYNC HELPERS
// All write operations save to BOTH localStorage AND Firestore
// ============================================================

const Cloud = {

  // ── Products ──────────────────────────────────────────────
  saveProduct: async (product) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('products', product.id), stripId(product));
    } catch(e) { console.error('[Cloud] saveProduct:', e); }
  },

  deleteProduct: async (id) => {
    if (!currentUID) return;
    try { await deleteDoc(userDoc('products', id)); }
    catch(e) { console.error('[Cloud] deleteProduct:', e); }
  },

  // ── Sales ─────────────────────────────────────────────────
  saveSale: async (sale) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('sales', sale.id), stripId(sale));
    } catch(e) { console.error('[Cloud] saveSale:', e); }
  },

  // ── Debts ─────────────────────────────────────────────────
  saveDebt: async (debt) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('debts', debt.id), stripId(debt));
    } catch(e) { console.error('[Cloud] saveDebt:', e); }
  },

  deleteDebt: async (id) => {
    if (!currentUID) return;
    try { await deleteDoc(userDoc('debts', id)); }
    catch(e) { console.error('[Cloud] deleteDebt:', e); }
  },

  // ── Expenses ──────────────────────────────────────────────
  saveExpense: async (expense) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('expenses', expense.id), stripId(expense));
    } catch(e) { console.error('[Cloud] saveExpense:', e); }
  },

  // ── Withdrawals ───────────────────────────────────────────
  saveWithdrawal: async (w) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('withdrawals', w.id), stripId(w));
    } catch(e) { console.error('[Cloud] saveWithdrawal:', e); }
  },

  // ── Settings ──────────────────────────────────────────────
  saveSettings: async (settings) => {
    if (!currentUID) return;
    try {
      await updateDoc(profileDoc(), { settings });
      // If settings include a staffAccount, mirror it to the public staffAuth collection
      // so staff can log in from the main portal on any device
      if (settings.staffAccount) {
        const profileSnap = await getDoc(profileDoc());
        const phone = profileSnap.exists() ? profileSnap.data().phone : null;
        if (phone) {
          let normalised = phone.replace(/\D/g, '');
          if (normalised.startsWith('254')) normalised = normalised.slice(3);
          if (normalised.startsWith('0'))   normalised = normalised.slice(1);
          const staffAuthDoc = doc(db, 'staffAuth', normalised);
          await setDoc(staffAuthDoc, {
            name:     settings.staffAccount.name,
            pin:      settings.staffAccount.pin,
            ownerUID: currentUID,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch(e) { console.error('[Cloud] saveSettings:', e); }
  },

  // ── Trial / Payment ───────────────────────────────────────
  saveTrial: async (trial) => {
    if (!currentUID) return;
    try {
      await updateDoc(profileDoc(), { trial });
    } catch(e) { console.error('[Cloud] saveTrial:', e); }
  },

  // ── Daily Savings ─────────────────────────────────────────
  saveDailySaving: async (saving) => {
    if (!currentUID) return;
    try {
      await setDoc(userDoc('daily_savings', saving.id), stripId(saving));
    } catch(e) { console.error('[Cloud] saveDailySaving:', e); }
  },
};

// Remove 'id' field before saving to Firestore (id is the document key)
function stripId(obj) {
  const { id, ...rest } = obj;
  return rest;
}

// ============================================================
// LOADING OVERLAY
// ============================================================

function showLoadingOverlay(msg = 'Loading...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(26,122,74,0.92);z-index:9999;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      color:white;font-family:'Nunito',sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:12px;animation:spin 1s linear infinite">⏳</div>
      <div id="loadingMsg" style="font-size:1rem;font-weight:800">${msg}</div>
      <div style="font-size:0.78rem;opacity:0.75;margin-top:6px">Please wait...</div>
    `;
    document.body.appendChild(overlay);
  } else {
    const msgEl = overlay.querySelector('#loadingMsg');
    if (msgEl) msgEl.textContent = msg;
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// AUTH STATE LISTENER
// Fires when user logs in or out (even on page refresh)
// ============================================================

function initFirebaseAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is logged in
      currentUID = user.uid;
      await loadUserDataFromCloud();
      initApp(); // defined in app.js
    } else {
      // Not logged in
      currentUID = null;
      Pages.show('loginPage');
    }
  });
}

// ============================================================
// EXPORT — make available to app.js
// ============================================================

window.Firebase = {
  register:         fbRegister,
  login:            fbLogin,
  logout:           fbLogout,
  cloud:            Cloud,
  getUID:           () => currentUID,
  initAuth:         initFirebaseAuth,
  showLoading:      showLoadingOverlay,
  hideLoading:      hideLoadingOverlay,

  // Look up staff credentials from the public staffAuth collection.
  // Called when staff log in from the main portal on a device that
  // doesn't have the owner's cached data.
  fetchStaffAuth: async (phone) => {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('254')) p = p.slice(3);
    if (p.startsWith('0'))   p = p.slice(1);
    try {
      const snap = await getDoc(doc(db, 'staffAuth', p));
      return snap.exists() ? snap.data() : null;
    } catch(e) {
      console.error('[Firebase] fetchStaffAuth:', e);
      return null;
    }
  },
};
