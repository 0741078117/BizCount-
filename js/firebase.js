/* ============================================================
   BIZCOUNT — Firebase Integration
   Uses Firebase Compat SDK (works from file:// and all browsers)

   Project: bizcount-d1064
   ============================================================ */

// ============================================================
// CONFIG + INIT
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDW5spPmnVA3m4slJ6LHdLuAcoVCpT3-QM",
  authDomain:        "bizcount-d1064.firebaseapp.com",
  projectId:         "bizcount-d1064",
  storageBucket:     "bizcount-d1064.firebasestorage.app",
  messagingSenderId: "1070911071179",
  appId:             "1:1070911071179:web:c38ece9bf8428b36568c4e",
  measurementId:     "G-607EJQ9G9E"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// Current owner UID (set after owner login)
let currentUID = null;

// ============================================================
// HELPERS
// ============================================================

const userCol    = (col)     => db.collection('users/' + currentUID + '/' + col);
const userDoc    = (col, id) => db.doc('users/' + currentUID + '/' + col + '/' + id);
const profileDoc = ()        => db.doc('users/' + currentUID);
const staffAuthDoc = (key)   => db.doc('staffAuth/' + key);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();

// Normalise phone to 9-digit key (e.g. "712345678")
function phoneKey(phone) {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('254')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  return p;
}

// Owner Firebase Auth email
function phoneToEmail(phone) {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('0'))   p = '254' + p.slice(1);
  if (!p.startsWith('254')) p = '254' + p;
  return p + '@bizcount.app';
}

// Staff Firebase Auth email (different namespace from owner)
function staffToEmail(ownerPhone) {
  return 'staff_' + phoneKey(ownerPhone) + '@bizcount.app';
}

// ============================================================
// OWNER AUTH — REGISTER
// ============================================================

async function fbRegister(name, phone, pin) {
  var email    = phoneToEmail(phone);
  var password = pin + phone.replace(/\D/g,'').slice(-4);

  try {
    showLoadingOverlay('Creating your account...');
    var cred = await auth.createUserWithEmailAndPassword(email, password);
    currentUID = cred.user.uid;

    await cred.user.updateProfile({ displayName: name });
    await profileDoc().set({
      name, phone, businessName: name,
      createdAt: TS(),
      trial: { start: new Date().toISOString().slice(0,10), paid: false },
      settings: { rent: 0, dailyRentSaving: 0, restockFund: 200, businessName: name, phone }
    });

    hideLoadingOverlay();
    return { ok: true, name };
  } catch (e) {
    hideLoadingOverlay();
    if (e.code === 'auth/email-already-in-use')
      return { ok: false, error: 'This phone already has an account. Please login.' };
    return { ok: false, error: e.message };
  }
}

// ============================================================
// OWNER AUTH — LOGIN
// ============================================================

async function fbLogin(phone, pin) {
  var email    = phoneToEmail(phone);
  var password = pin + phone.replace(/\D/g,'').slice(-4);

  try {
    showLoadingOverlay('Logging in...');
    var cred = await auth.signInWithEmailAndPassword(email, password);
    currentUID = cred.user.uid;
    hideLoadingOverlay();
    return { ok: true };
  } catch (e) {
    hideLoadingOverlay();
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential')
      return { ok: false, error: 'Account not found. Check your number or register.' };
    if (e.code === 'auth/wrong-password')
      return { ok: false, error: 'Wrong PIN. Please try again.' };
    return { ok: false, error: 'Login failed. Check your internet and try again.' };
  }
}

// ============================================================
// OWNER AUTH — LOGOUT
// ============================================================

async function fbLogout() {
  await auth.signOut();
  currentUID = null;
  Object.keys(localStorage)
    .filter(function(k) { return k.startsWith('bizcount_'); })
    .forEach(function(k) { localStorage.removeItem(k); });
}

// ============================================================
// STAFF ACCOUNT SETUP
// Creates a real Firebase Auth account for staff using a
// secondary app — so owner's session is never interrupted.
// ============================================================

async function createStaffAccount(ownerPhone, staffName, staffPin) {
  var sEmail    = staffToEmail(ownerPhone);
  var sPassword = staffPin + phoneKey(ownerPhone).slice(-4);
  var secondaryApp = null;

  try {
    secondaryApp = firebase.initializeApp(firebaseConfig, 'staff-setup-' + Date.now());
    var staffUID;

    try {
      var cred = await secondaryApp.auth().createUserWithEmailAndPassword(sEmail, sPassword);
      staffUID  = cred.user.uid;
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        // Account exists — sign in to retrieve UID
        var cred2 = await secondaryApp.auth().signInWithEmailAndPassword(sEmail, sPassword);
        staffUID  = cred2.user.uid;
      } else {
        throw e;
      }
    }

    await secondaryApp.auth().signOut();
    return { ok: true, staffUID: staffUID };

  } catch (e) {
    console.error('[Firebase] createStaffAccount:', e);
    return { ok: false, error: e.message };
  } finally {
    if (secondaryApp) { try { await secondaryApp.delete(); } catch(_) {} }
  }
}

// ============================================================
// STAFF AUTH — WRITE staffAuth DOCUMENT
// Stores credentials + product snapshot so staff can work on
// any device without needing owner to be logged in.
// ============================================================

async function writeStaffAuth(ownerPhone, staffName, staffPin, staffUID) {
  if (!currentUID) return;
  var key = phoneKey(ownerPhone);

  try {
    // Snapshot products for staff fresh-device access
    var productsSnap = await userCol('products').get();
    var products = [];
    productsSnap.forEach(function(d) { products.push(Object.assign({ id: d.id }, d.data())); });

    var settingsSnap = await profileDoc().get();
    var settings = settingsSnap.exists ? (settingsSnap.data().settings || {}) : {};

    await staffAuthDoc(key).set({
      name:              staffName,
      pin:               staffPin,
      staffUID:          staffUID || null,
      ownerUID:          currentUID,
      ownerPhone:        ownerPhone,
      productsSnapshot:  products,
      settingsSnapshot:  settings,
      updatedAt:         TS()
    });
  } catch(e) { console.error('[Firebase] writeStaffAuth:', e); }
}

// ============================================================
// STAFF AUTH — LOGIN
// Works on ANY device — no owner session needed.
// Step 1: verify PIN against public staffAuth document
// Step 2: sign in with staff Firebase account
// Step 3: populate localStorage from snapshot
// ============================================================

async function fbStaffLogin(ownerPhone, staffPin) {
  var key = phoneKey(ownerPhone);

  try {
    showLoadingOverlay('Checking staff credentials...');

    // 1. Verify PIN (public read — no Firebase Auth needed)
    var snap = await staffAuthDoc(key).get();
    if (!snap.exists) {
      hideLoadingOverlay();
      return { ok: false, error: 'Shop not found. Check the phone number.' };
    }
    var staffData = snap.data();
    if (staffData.pin !== staffPin) {
      hideLoadingOverlay();
      return { ok: false, error: 'Wrong PIN. Try again.' };
    }

    // 2. Populate localStorage from snapshot (gives staff data on any device)
    if (staffData.productsSnapshot && staffData.productsSnapshot.length) {
      DB.set('products', staffData.productsSnapshot);
    }
    if (staffData.settingsSnapshot) {
      DB.set('settings', staffData.settingsSnapshot);
    }
    DB.set('staff_account', { name: staffData.name, pin: staffData.pin });

    // 3. Sign in with staff Firebase Auth account (if one was created)
    if (staffData.staffUID) {
      try {
        var sEmail    = staffToEmail(ownerPhone);
        var sPassword = staffPin + key.slice(-4);
        await auth.signInWithEmailAndPassword(sEmail, sPassword);
      } catch(e) {
        // Firebase auth failed — still allow access with snapshot data
        console.warn('[Firebase] Staff Firebase sign-in skipped:', e.code);
      }
    }

    hideLoadingOverlay();
    return { ok: true, staffData: staffData };

  } catch (e) {
    hideLoadingOverlay();
    console.error('[Firebase] fbStaffLogin:', e);
    return { ok: false, error: 'Login failed. Check your internet and try again.' };
  }
}

// Look up staff record (PIN verification only, no auth sign-in)
async function fetchStaffAuth(phone) {
  try {
    var snap = await staffAuthDoc(phoneKey(phone)).get();
    return snap.exists ? snap.data() : null;
  } catch(e) {
    console.error('[Firebase] fetchStaffAuth:', e);
    return null;
  }
}

// ============================================================
// LOAD OWNER DATA → LOCAL CACHE
// ============================================================

async function loadUserDataFromCloud() {
  if (!currentUID) return;
  showLoadingOverlay('Loading your business data...');
  try {
    var profileSnap = await profileDoc().get();
    if (profileSnap.exists) {
      var profile = profileSnap.data();
      DB.set('user', { name: profile.name, phone: profile.phone, pin: '****' });
      if (profile.settings) DB.set('settings', profile.settings);
      if (profile.trial)    DB.set('trial',    profile.trial);
    }

    var productsSnap = await userCol('products').get();
    var products = [];
    productsSnap.forEach(function(d) { products.push(Object.assign({ id: d.id }, d.data())); });
    DB.set('products', products);

    var salesSnap = await userCol('sales').orderBy('createdAt', 'desc').get();
    var sales = [];
    salesSnap.forEach(function(d) { sales.push(Object.assign({ id: d.id }, d.data())); });
    DB.set('sales', sales);

    var debtsSnap = await userCol('debts').get();
    var debts = [];
    debtsSnap.forEach(function(d) { debts.push(Object.assign({ id: d.id }, d.data())); });
    DB.set('debts', debts);

    var expensesSnap = await userCol('expenses').orderBy('createdAt', 'desc').get();
    var expenses = [];
    expensesSnap.forEach(function(d) { expenses.push(Object.assign({ id: d.id }, d.data())); });
    DB.set('expenses', expenses);

    var withdrawalsSnap = await userCol('withdrawals').get();
    var withdrawals = [];
    withdrawalsSnap.forEach(function(d) { withdrawals.push(Object.assign({ id: d.id }, d.data())); });
    DB.set('withdrawals', withdrawals);

    var savingsSnap = await userCol('daily_savings').get();
    var savings = [];
    savingsSnap.forEach(function(d) { savings.push(Object.assign({ id: d.id }, d.data())); });
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
// CLOUD SYNC HELPERS
// ============================================================

var Cloud = {

  saveProduct: async function(product) {
    if (!currentUID) return;
    try { await userDoc('products', product.id).set(stripId(product)); }
    catch(e) { console.error('[Cloud] saveProduct:', e); }
  },

  deleteProduct: async function(id) {
    if (!currentUID) return;
    try { await userDoc('products', id).delete(); }
    catch(e) { console.error('[Cloud] deleteProduct:', e); }
  },

  saveSale: async function(sale) {
    if (!currentUID) return;
    try { await userDoc('sales', sale.id).set(stripId(sale)); }
    catch(e) { console.error('[Cloud] saveSale:', e); }
  },

  saveDebt: async function(debt) {
    if (!currentUID) return;
    try { await userDoc('debts', debt.id).set(stripId(debt)); }
    catch(e) { console.error('[Cloud] saveDebt:', e); }
  },

  deleteDebt: async function(id) {
    if (!currentUID) return;
    try { await userDoc('debts', id).delete(); }
    catch(e) { console.error('[Cloud] deleteDebt:', e); }
  },

  saveExpense: async function(expense) {
    if (!currentUID) return;
    try { await userDoc('expenses', expense.id).set(stripId(expense)); }
    catch(e) { console.error('[Cloud] saveExpense:', e); }
  },

  saveWithdrawal: async function(w) {
    if (!currentUID) return;
    try { await userDoc('withdrawals', w.id).set(stripId(w)); }
    catch(e) { console.error('[Cloud] saveWithdrawal:', e); }
  },

  saveSettings: async function(settings) {
    if (!currentUID) return;
    try {
      await profileDoc().update({ settings: settings });
      // Auto-refresh staff snapshot so their data stays current
      var user     = DB.get('user', null);
      var staffAcc = DB.get('staff_account', null);
      if (user && user.phone && staffAcc) {
        await writeStaffAuth(user.phone, staffAcc.name, staffAcc.pin, null);
      }
    } catch(e) { console.error('[Cloud] saveSettings:', e); }
  },

  saveTrial: async function(trial) {
    if (!currentUID) return;
    try { await profileDoc().update({ trial: trial }); }
    catch(e) { console.error('[Cloud] saveTrial:', e); }
  },

  saveDailySaving: async function(saving) {
    if (!currentUID) return;
    try { await userDoc('daily_savings', saving.id).set(stripId(saving)); }
    catch(e) { console.error('[Cloud] saveDailySaving:', e); }
  },
};

function stripId(obj) {
  var out = {};
  Object.keys(obj).forEach(function(k) { if (k !== 'id') out[k] = obj[k]; });
  return out;
}

// ============================================================
// LOADING OVERLAY
// ============================================================

function showLoadingOverlay(msg) {
  msg = msg || 'Loading...';
  var overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:rgba(26,122,74,0.93);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'color:white;font-family:Nunito,sans-serif;';
    overlay.innerHTML =
      '<div style="font-size:2.4rem;margin-bottom:14px">⏳</div>' +
      '<div id="loadingMsg" style="font-size:1rem;font-weight:800">' + msg + '</div>' +
      '<div style="font-size:0.76rem;opacity:0.72;margin-top:6px">Please wait...</div>';
    document.body.appendChild(overlay);
  } else {
    var el = overlay.querySelector('#loadingMsg');
    if (el) el.textContent = msg;
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// AUTH STATE LISTENER
// Handles: owner login, staff login, page-refresh restore
// ============================================================

function initFirebaseAuth() {
  auth.onAuthStateChanged(async function(user) {
    var staffMode = DB.get('staff_mode', false);
    var staffAcc  = DB.get('staff_account', null);

    if (user) {
      if (staffMode && staffAcc) {
        // Staff Firebase account is signed in — show staff UI
        initStaffSession(staffAcc);
      } else {
        // Owner login
        currentUID = user.uid;
        await loadUserDataFromCloud();
        initApp();
      }

    } else {
      // No Firebase session
      if (staffMode && staffAcc) {
        // Restore staff from localStorage (page refresh on same device)
        initStaffSession(staffAcc);
      } else {
        currentUID = null;
        Pages.show('loginPage');
      }
    }
  });
}

// ============================================================
// EXPORT
// ============================================================

window.Firebase = {
  // Owner
  register:           fbRegister,
  login:              fbLogin,
  logout:             fbLogout,

  // Staff
  staffLogin:         fbStaffLogin,
  createStaffAccount: createStaffAccount,
  writeStaffAuth:     writeStaffAuth,
  fetchStaffAuth:     fetchStaffAuth,

  // Sync
  cloud:              Cloud,

  // Util
  getUID:             function() { return currentUID; },
  initAuth:           initFirebaseAuth,
  showLoading:        showLoadingOverlay,
  hideLoading:        hideLoadingOverlay,
};
