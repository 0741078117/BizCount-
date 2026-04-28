/* ============================================================
   BIZCOUNT - Main Application Logic
   Offline-first, localStorage-powered Kenyan business tracker
   ============================================================
   
   BACKEND INTEGRATION POINTS are marked:
   // ===== FIREBASE: =====
   
   DARAJA API INTEGRATION points are marked:
   // ===== DARAJA API: =====
   ============================================================ */

'use strict';

// ============================================================
// APP STATE & CONSTANTS
// ============================================================

const APP = {
  version: '1.0.0',
  currency: 'KSh',
  trialDays: 3,
  monthlyPrice: 200,
};

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

const DB = {
  get: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(`bizcount_${key}`);
      return val !== null ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(`bizcount_${key}`, JSON.stringify(val)); return true; }
    catch { return false; }
  },
  del: (key) => localStorage.removeItem(`bizcount_${key}`),
};

// ============================================================
// DATA MODELS (getters with defaults)
// ============================================================

const Data = {
  getUser:       () => DB.get('user',       null),
  getProducts:   () => DB.get('products',   []),
  getSales:      () => DB.get('sales',      []),
  getDebts:      () => DB.get('debts',      []),
  getExpenses:   () => DB.get('expenses',   []),
  getSettings:   () => DB.get('settings',   { rent: 0, businessName: 'My Shop', phone: '' }),
  getWithdrawals:() => DB.get('withdrawals',[]),
  getTrial:      () => DB.get('trial',      null),

  saveProducts:   (d) => DB.set('products',   d),
  saveSales:      (d) => DB.set('sales',      d),
  saveDebts:      (d) => DB.set('debts',      d),
  saveExpenses:   (d) => DB.set('expenses',   d),
  saveSettings:   (d) => DB.set('settings',   d),
  saveWithdrawals:(d) => DB.set('withdrawals',d),
  saveUser:       (d) => DB.set('user',       d),
  saveTrial:      (d) => DB.set('trial',      d),
};

// ============================================================
// UNIQUE ID GENERATOR
// ============================================================

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

// ============================================================
// DATE HELPERS
// ============================================================

const Dates = {
  today: () => new Date().toISOString().slice(0, 10),
  now:   () => new Date().toISOString(),
  format: (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' });
  },
  timeAgo: (iso) => {
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)   return 'Just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400)return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  },
  daysInMonth: () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  },
  dayOfMonth: () => new Date().getDate(),
};

// ============================================================
// CURRENCY FORMATTER
// ============================================================

const fmt = (n) => `${APP.currency} ${Number(n || 0).toLocaleString('en-KE')}`;

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 2800);
}

// ============================================================
// PAGE ROUTER
// ============================================================

const Pages = {
  current: null,
  show: (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(id);
    if (page) page.classList.add('active');
    Pages.current = id;
  }
};

// ============================================================
// TRIAL SYSTEM
// ============================================================

const Trial = {
  init: () => {
    let trial = Data.getTrial();
    if (!trial) {
      trial = { start: Dates.today(), paid: false };
      Data.saveTrial(trial);
    }
    return trial;
  },

  daysElapsed: () => {
    const trial = Data.getTrial();
    if (!trial) return 0;
    const diff = (Date.now() - new Date(trial.start)) / 86400000;
    return Math.floor(diff);
  },

  daysLeft: () => Math.max(0, APP.trialDays - Trial.daysElapsed()),

  isExpired: () => {
    const trial = Data.getTrial();
    if (!trial || trial.paid) return false;
    return Trial.daysElapsed() >= APP.trialDays;
  },

  isPaid: () => {
    const trial = Data.getTrial();
    return trial && trial.paid;
  },

  markPaid: () => {
    const trial = Data.getTrial() || {};
    trial.paid = true;
    Data.saveTrial(trial);
    // ===== FIREBASE: Update subscription status in Firestore =====
    // firebase.firestore().doc(`users/${currentUser.uid}`).update({ paid: true, paidAt: new Date() })
  },

  renderBanner: () => {
    const banner = document.getElementById('trialBanner');
    const daysLeft = Trial.daysLeft();
    if (!banner) return;
    if (Trial.isPaid()) {
      banner.classList.add('hidden');
      return;
    }
    if (daysLeft > 0) {
      banner.classList.remove('hidden');
      const txt = banner.querySelector('.tb-text');
      if (txt) txt.textContent = `🎁 Free trial: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    } else {
      banner.classList.add('hidden');
    }
  },

  checkPaywall: () => {
    if (Trial.isExpired() && !Trial.isPaid()) {
      openPaywall();
      return true;
    }
    return false;
  }
};

// ============================================================
// AUTH SYSTEM
// ============================================================

const Auth = {
  isLoggedIn: () => !!Data.getUser(),

  login: (phone, pin) => {
    // ===== FIREBASE: firebase.auth().signInWithPhoneNumber =====
    // Simulated local auth
    const user = Data.getUser();
    if (!user) { showToast('Account not found. Please register.', 'error'); return false; }
    if (user.pin !== pin) { showToast('Wrong PIN. Try again.', 'error'); return false; }
    showToast(`Welcome back, ${user.name}! 👋`, 'success');
    return true;
  },

  register: (name, phone, pin) => {
    // ===== FIREBASE: firebase.auth().createUserWithEmailAndPassword OR phone auth =====
    if (!name || !phone || !pin) { showToast('Please fill all fields.', 'error'); return false; }
    if (pin.length < 4) { showToast('PIN must be 4 digits.', 'error'); return false; }
    const settings = Data.getSettings();
    settings.businessName = name;
    settings.phone = phone;
    Data.saveSettings(settings);
    Data.saveUser({ name, phone, pin, createdAt: Dates.now() });
    Trial.init();
    showToast(`Account created! Welcome, ${name} 🎉`, 'success');
    return true;
  },

  logout: () => {
    // ===== FIREBASE: firebase.auth().signOut() =====
    Pages.show('loginPage');
  }
};

// ============================================================
// PRODUCTS MODULE
// ============================================================

const Products = {
  add: (data) => {
    const products = Data.getProducts();
    const product = {
      id: uid(),
      name: data.name,
      icon: data.icon || '📦',
      buyPrice: parseFloat(data.buyPrice) || 0,
      sellPrice: parseFloat(data.sellPrice) || 0,
      quantity: parseInt(data.quantity) || 0,
      lowStockAt: parseInt(data.lowStockAt) || 5,
      salesCount: 0,
      createdAt: Dates.now(),
    };
    product.profit = product.sellPrice - product.buyPrice;
    products.push(product);
    Data.saveProducts(products);
    // ===== FIREBASE: firestore().collection('products').add(product) =====
    showToast(`✅ "${product.name}" added!`);
    return product;
  },

  update: (id, changes) => {
    const products = Data.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return false;
    products[idx] = { ...products[idx], ...changes };
    products[idx].profit = products[idx].sellPrice - products[idx].buyPrice;
    Data.saveProducts(products);
    return true;
  },

  delete: (id) => {
    const products = Data.getProducts().filter(p => p.id !== id);
    Data.saveProducts(products);
    showToast('Product deleted.', 'info');
  },

  getById: (id) => Data.getProducts().find(p => p.id === id),

  isLowStock: (p) => p.quantity <= p.lowStockAt,
  isFastMoving: (p) => p.salesCount >= 10,

  render: () => {
    const products = Data.getProducts();
    const list = document.getElementById('productList');
    const empty = document.getElementById('productEmpty');
    if (!list) return;

    list.innerHTML = '';

    if (!products.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    products.forEach((p, i) => {
      const isLow  = Products.isLowStock(p);
      const isFast = Products.isFastMoving(p);
      let badge = `<span class="stock-badge ok">In Stock</span>`;
      if (isLow) badge = `<span class="stock-badge low">⚠️ Low</span>`;
      if (isFast) badge += `<span class="stock-badge fast" style="margin-left:4px">🔥 Fast</span>`;

      const el = document.createElement('div');
      el.className = 'product-item';
      el.style.animationDelay = `${i * 0.05}s`;
      el.innerHTML = `
        <div class="product-icon">${p.icon}</div>
        <div class="product-info">
          <div class="p-name">${p.name}</div>
          <div class="p-meta">Buy: ${fmt(p.buyPrice)} · Sell: ${fmt(p.sellPrice)}</div>
          <div class="p-meta" style="margin-top:4px">${badge}</div>
        </div>
        <div class="product-right">
          <div class="p-profit">+${fmt(p.profit)}</div>
          <div class="p-stock" style="margin-top:4px">Qty: ${p.quantity}</div>
          <button class="btn btn-sm btn-secondary" style="margin-top:6px" onclick="openEditProduct('${p.id}')">Edit</button>
        </div>
      `;
      list.appendChild(el);
    });
  }
};

// ============================================================
// SALES MODULE
// ============================================================

const Sales = {
  record: (productId, qty, paymentMethod = 'cash') => {
    const product = Products.getById(productId);
    if (!product) return false;
    if (product.quantity < qty) {
      showToast(`Not enough stock for ${product.name}!`, 'error');
      return false;
    }

    const sale = {
      id: uid(),
      productId,
      productName: product.name,
      qty: parseInt(qty),
      sellPrice: product.sellPrice,
      buyPrice: product.buyPrice,
      revenue: product.sellPrice * qty,
      profit: (product.sellPrice - product.buyPrice) * qty,
      paymentMethod,
      date: Dates.today(),
      createdAt: Dates.now(),
    };

    const sales = Data.getSales();
    sales.push(sale);
    Data.saveSales(sales);

    // Update product stock & salesCount
    Products.update(productId, {
      quantity: product.quantity - qty,
      salesCount: (product.salesCount || 0) + qty
    });

    // ===== FIREBASE: firestore().collection('sales').add(sale) =====
    showToast(`💰 Sale recorded: +${fmt(sale.profit)} profit!`);
    return sale;
  },

  todayTotal: () => {
    const today = Dates.today();
    return Data.getSales()
      .filter(s => s.date === today)
      .reduce((sum, s) => sum + s.profit, 0);
  },

  todayRevenue: () => {
    const today = Dates.today();
    return Data.getSales()
      .filter(s => s.date === today)
      .reduce((sum, s) => sum + s.revenue, 0);
  },

  monthTotal: () => {
    const month = Dates.today().slice(0, 7);
    return Data.getSales()
      .filter(s => s.date.startsWith(month))
      .reduce((sum, s) => sum + s.profit, 0);
  },

  monthRevenue: () => {
    const month = Dates.today().slice(0, 7);
    return Data.getSales()
      .filter(s => s.date.startsWith(month))
      .reduce((sum, s) => sum + s.revenue, 0);
  },

  recent: (n = 5) => {
    return Data.getSales()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, n);
  }
};

// ============================================================
// DEBTS (MADENI) MODULE
// ============================================================

const Debts = {
  add: (data) => {
    const debts = Data.getDebts();
    const debt = {
      id: uid(),
      customerName: data.customerName,
      phone: data.phone || '',
      amount: parseFloat(data.amount) || 0,
      paidAmount: 0,
      description: data.description || '',
      status: 'pending',
      date: Dates.today(),
      createdAt: Dates.now(),
    };
    debts.push(debt);
    Data.saveDebts(debts);
    // ===== FIREBASE: firestore().collection('debts').add(debt) =====
    showToast(`📝 Debt recorded for ${debt.customerName}`);
    return debt;
  },

  markPaid: (id, amount) => {
    const debts = Data.getDebts();
    const idx = debts.findIndex(d => d.id === id);
    if (idx === -1) return false;
    const debt = debts[idx];
    debt.paidAmount += parseFloat(amount) || debt.amount;
    debt.status = debt.paidAmount >= debt.amount ? 'paid' : 'partial';
    debt.updatedAt = Dates.now();
    Data.saveDebts(debts);
    showToast(debt.status === 'paid' ? `✅ ${debt.customerName} cleared their debt!` : `💸 Partial payment recorded.`);
    return true;
  },

  delete: (id) => {
    const debts = Data.getDebts().filter(d => d.id !== id);
    Data.saveDebts(debts);
    showToast('Debt record deleted.', 'info');
  },

  totalOwed: () => {
    return Data.getDebts()
      .filter(d => d.status !== 'paid')
      .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
  },

  render: () => {
    const debts = Data.getDebts();
    const list = document.getElementById('debtList');
    const empty = document.getElementById('debtEmpty');
    if (!list) return;

    list.innerHTML = '';

    const active = debts.filter(d => d.status !== 'paid');
    if (!active.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    active.forEach((d, i) => {
      const initials = d.customerName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const remaining = d.amount - d.paidAmount;
      const el = document.createElement('div');
      el.className = 'debt-item';
      el.style.animationDelay = `${i * 0.05}s`;
      el.innerHTML = `
        <div class="debt-avatar">${initials}</div>
        <div class="debt-info">
          <div class="d-name">${d.customerName}</div>
          <div class="d-date">${d.description || 'No description'} · ${Dates.format(d.createdAt)}</div>
          <div style="margin-top:6px">
            <span class="debt-status ${d.status}">${d.status}</span>
            ${d.phone ? `<a href="tel:${d.phone}" style="margin-left:8px;font-size:0.75rem;color:var(--green);font-weight:700;">📞 Call</a>` : ''}
          </div>
        </div>
        <div class="debt-right">
          <div class="d-amount">${fmt(remaining)}</div>
          <button class="btn btn-sm btn-secondary" style="margin-top:6px" onclick="openPayDebt('${d.id}')">Pay</button>
        </div>
      `;
      list.appendChild(el);
    });
  }
};

// ============================================================
// EXPENSES MODULE
// ============================================================

const Expenses = {
  add: (data) => {
    const expenses = Data.getExpenses();
    const expense = {
      id: uid(),
      category: data.category,
      description: data.description || data.category,
      amount: parseFloat(data.amount) || 0,
      date: Dates.today(),
      createdAt: Dates.now(),
    };
    expenses.push(expense);
    Data.saveExpenses(expenses);
    // ===== FIREBASE: firestore().collection('expenses').add(expense) =====
    showToast(`📋 Expense added: ${fmt(expense.amount)}`);
    return expense;
  },

  todayTotal: () => {
    const today = Dates.today();
    return Data.getExpenses()
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);
  },

  monthTotal: () => {
    const month = Dates.today().slice(0, 7);
    return Data.getExpenses()
      .filter(e => e.date.startsWith(month))
      .reduce((sum, e) => sum + e.amount, 0);
  }
};

// ============================================================
// RENT / SAVINGS TRACKER
// ============================================================

const RentTracker = {
  dailySavingsNeeded: () => {
    const settings = Data.getSettings();
    const rent = parseFloat(settings.rent) || 0;
    const daysLeft = Dates.daysInMonth() - Dates.dayOfMonth() + 1;
    return daysLeft > 0 ? Math.ceil(rent / daysLeft) : rent;
  },

  monthSaved: () => {
    // Uses month profit minus expenses as proxy for saved amount
    const profit  = Sales.monthTotal();
    const expenses = Expenses.monthTotal();
    const withdrawals = Data.getWithdrawals()
      .filter(w => w.date.startsWith(Dates.today().slice(0,7)))
      .reduce((s, w) => s + w.amount, 0);
    return Math.max(0, profit - expenses - withdrawals);
  },

  rentProgress: () => {
    const settings = Data.getSettings();
    const rent = parseFloat(settings.rent) || 0;
    if (!rent) return 0;
    return Math.min(100, Math.round((RentTracker.monthSaved() / rent) * 100));
  }
};

// ============================================================
// WITHDRAWALS (Personal Money)
// ============================================================

const Withdrawals = {
  add: (amount, note = '') => {
    const w = Data.getWithdrawals();
    w.push({ id: uid(), amount: parseFloat(amount)||0, note, date: Dates.today(), createdAt: Dates.now() });
    Data.saveWithdrawals(w);
    showToast(`💸 Withdrawal of ${fmt(amount)} recorded.`, 'info');
  },
  todayTotal: () => {
    const today = Dates.today();
    return Data.getWithdrawals()
      .filter(w => w.date === today)
      .reduce((s, w) => s + w.amount, 0);
  },
  monthTotal: () => {
    const month = Dates.today().slice(0, 7);
    return Data.getWithdrawals()
      .filter(w => w.date.startsWith(month))
      .reduce((s, w) => s + w.amount, 0);
  }
};

// ============================================================
// DASHBOARD RENDER
// ============================================================

function renderDashboard() {
  const todayProfit  = Sales.todayTotal();
  const todayRevenue = Sales.todayRevenue();
  const todayExpenses= Expenses.todayTotal();
  const monthProfit  = Sales.monthTotal();
  const totalDebt    = Debts.totalOwed();
  const dailySave    = RentTracker.dailySavingsNeeded();
  const rentProgress = RentTracker.rentProgress();
  const settings     = Data.getSettings();
  const withdrawal   = Withdrawals.todayTotal();

  // Net today
  const netToday = todayProfit - todayExpenses;

  // Hero
  const heroNum = document.getElementById('heroProfitNum');
  const heroDate = document.getElementById('heroDate');
  if (heroNum) heroNum.textContent = fmt(netToday);
  if (heroDate) {
    const now = new Date();
    heroDate.textContent = now.toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long' });
  }

  // Set color based on profit
  const hero = document.getElementById('heroCard');
  if (hero) {
    hero.style.background = netToday >= 0
      ? 'linear-gradient(135deg, var(--green) 0%, #0F5230 100%)'
      : 'linear-gradient(135deg, #C0392B 0%, #922B21 100%)';
  }

  // Stat cards
  _setEl('statRevenue',    fmt(todayRevenue));
  _setEl('statExpenses',   fmt(todayExpenses));
  _setEl('statDebt',       fmt(totalDebt));
  _setEl('statMonthProfit',fmt(monthProfit));

  // Do Not Spend money
  const doNotSpend = Math.max(0, dailySave - Withdrawals.todayTotal());
  _setEl('doNotSpendAmt', fmt(doNotSpend));

  // Daily save box
  _setEl('dailySaveAmt', fmt(dailySave));
  _setEl('dailySaveSub', `for ${Dates.daysInMonth() - Dates.dayOfMonth() + 1} days remaining this month`);

  // Rent progress
  const settings2 = Data.getSettings();
  const rent = parseFloat(settings2.rent) || 0;
  const saved = RentTracker.monthSaved();
  _setEl('rentProgressLabel', `${fmt(saved)} / ${fmt(rent)}`);
  _setEl('rentProgressPct', `${rentProgress}%`);
  const fill = document.getElementById('rentProgressFill');
  if (fill) {
    fill.style.width = `${rentProgress}%`;
    fill.className = `progress-fill ${rentProgress < 50 ? 'danger' : rentProgress < 80 ? 'gold' : ''}`;
  }

  // Cash flow split
  const businessMoney = Math.max(0, monthProfit - Expenses.monthTotal() - Withdrawals.monthTotal());
  const personalMoney = Withdrawals.monthTotal();
  _setEl('cfBusiness', fmt(businessMoney));
  _setEl('cfPersonal',  fmt(personalMoney));

  // Recent transactions
  renderRecentActivity();

  // Warnings
  renderWarnings();
}

function renderWarnings() {
  const container = document.getElementById('warningsArea');
  if (!container) return;
  container.innerHTML = '';

  const products = Data.getProducts();
  const lowStock = products.filter(p => Products.isLowStock(p));
  if (lowStock.length) {
    container.innerHTML += `
      <div class="warning-banner">
        <span class="w-icon">⚠️</span>
        <span class="w-text">Low stock: <strong>${lowStock.map(p => p.name).join(', ')}</strong> — restock soon!</span>
      </div>`;
  }

  const debts = Data.getDebts().filter(d => d.status !== 'paid');
  if (debts.length) {
    container.innerHTML += `
      <div class="warning-banner">
        <span class="w-icon">📋</span>
        <span class="w-text"><strong>${debts.length} customer${debts.length>1?'s':''}</strong> owe${debts.length===1?'s':''} you ${fmt(Debts.totalOwed())} in total.</span>
      </div>`;
  }

  const trial = Data.getTrial();
  if (trial && !trial.paid && Trial.daysLeft() === 0) {
    container.innerHTML += `
      <div class="danger-banner">
        <span class="w-icon">🔒</span>
        <span class="w-text">Your free trial has ended. <strong>Pay KSh 200</strong> to continue using BizCount.</span>
      </div>`;
  }
}

function renderRecentActivity() {
  const list = document.getElementById('recentActivity');
  if (!list) return;
  list.innerHTML = '';

  const sales = Sales.recent(4);
  if (!sales.length) {
    list.innerHTML = `<div class="empty-state" style="padding:20px 0">
      <div class="e-icon">📊</div>
      <div class="e-text">No sales yet today</div>
      <div class="e-sub">Tap + to record your first sale</div>
    </div>`;
    return;
  }

  sales.forEach(s => {
    list.innerHTML += `
      <div class="tx-item">
        <div class="tx-dot sale">💰</div>
        <div class="tx-info">
          <div class="tx-name">${s.productName} × ${s.qty}</div>
          <div class="tx-time">${Dates.timeAgo(s.createdAt)} · ${s.paymentMethod === 'mpesa' ? '📱 M-Pesa' : '💵 Cash'}</div>
        </div>
        <div class="tx-amount plus">+${fmt(s.profit)}</div>
      </div>`;
  });
}

// ============================================================
// SETTINGS RENDER
// ============================================================

function renderSettings() {
  const settings = Data.getSettings();
  const user = Data.getUser();
  _setEl('settingBusinessName', settings.businessName || 'My Shop');
  _setEl('settingPhone', user ? user.phone : '');
  _setEl('settingRentDisplay', fmt(settings.rent || 0));

  const trial = Data.getTrial();
  const statusEl = document.getElementById('subscriptionStatus');
  if (statusEl) {
    if (Trial.isPaid()) {
      statusEl.innerHTML = `<span style="color:var(--green);font-weight:800;">✅ Active — Full Access</span>`;
    } else if (Trial.daysLeft() > 0) {
      statusEl.innerHTML = `<span style="color:var(--gold);font-weight:800;">🎁 Free Trial — ${Trial.daysLeft()} day(s) left</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:var(--red);font-weight:800;">🔒 Trial Expired — Upgrade</span>`;
    }
  }
}

// ============================================================
// UI HELPER
// ============================================================

function _setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// MODAL CONTROLS
// ============================================================

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

function openPaywall() {
  openModal('paywallModal');
}

// ============================================================
// PRODUCT MODALS
// ============================================================

function openAddProduct() {
  if (Trial.checkPaywall()) return;
  openModal('addProductModal');
}

function openEditProduct(id) {
  const p = Products.getById(id);
  if (!p) return;
  document.getElementById('editProductId').value = p.id;
  document.getElementById('editProductName').value = p.name;
  document.getElementById('editBuyPrice').value = p.buyPrice;
  document.getElementById('editSellPrice').value = p.sellPrice;
  document.getElementById('editQuantity').value = p.quantity;
  document.getElementById('editLowStock').value = p.lowStockAt;
  openModal('editProductModal');
}

function submitAddProduct() {
  const name  = document.getElementById('newProductName').value.trim();
  const buy   = document.getElementById('newBuyPrice').value;
  const sell  = document.getElementById('newSellPrice').value;
  const qty   = document.getElementById('newQuantity').value;
  const low   = document.getElementById('newLowStock').value || 5;
  const icons = ['📦','🥬','👗','🧴','🥩','🛒','🍞','🧺','👟','🍫','🥤','🧃'];
  const icon  = icons[Math.floor(Math.random() * icons.length)];

  if (!name || !buy || !sell) { showToast('Please fill in name, buy price, sell price.', 'error'); return; }
  if (parseFloat(sell) < parseFloat(buy)) {
    showToast('⚠️ Selling price is less than buying price — you will lose money!', 'error');
    return;
  }

  Products.add({ name, buyPrice: buy, sellPrice: sell, quantity: qty || 0, lowStockAt: low, icon });
  closeModal('addProductModal');
  document.getElementById('addProductForm').reset();
  Products.render();
  renderDashboard();
}

function submitEditProduct() {
  const id   = document.getElementById('editProductId').value;
  const name = document.getElementById('editProductName').value.trim();
  const buy  = document.getElementById('editBuyPrice').value;
  const sell = document.getElementById('editSellPrice').value;
  const qty  = document.getElementById('editQuantity').value;
  const low  = document.getElementById('editLowStock').value;

  if (!name || !buy || !sell) { showToast('Please fill all fields.', 'error'); return; }
  Products.update(id, { name, buyPrice: parseFloat(buy), sellPrice: parseFloat(sell), quantity: parseInt(qty), lowStockAt: parseInt(low) });
  closeModal('editProductModal');
  Products.render();
  renderDashboard();
  showToast('✅ Product updated!');
}

function deleteProductFromEdit() {
  const id = document.getElementById('editProductId').value;
  if (confirm('Delete this product?')) {
    Products.delete(id);
    closeModal('editProductModal');
    Products.render();
    renderDashboard();
  }
}

// ============================================================
// SALE MODAL
// ============================================================

function openRecordSale() {
  if (Trial.checkPaywall()) return;
  const products = Data.getProducts();
  const grid = document.getElementById('saleProductGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!products.length) {
    showToast('Add products first!', 'error');
    openTab('products');
    return;
  }

  products.forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'sale-product-btn';
    btn.dataset.id = p.id;
    btn.innerHTML = `
      <div style="font-size:1.5rem">${p.icon}</div>
      <div class="spb-name">${p.name}</div>
      <div class="spb-price">${fmt(p.sellPrice)}</div>
      <div class="spb-price" style="margin-top:2px;font-size:0.7rem;color:var(--muted)">Qty: ${p.quantity}</div>`;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.sale-product-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('selectedProductPreview').textContent = `${p.name} — ${fmt(p.sellPrice)} each`;
    });
    grid.appendChild(btn);
  });

  openModal('recordSaleModal');
}

function submitSale() {
  const selected = document.querySelector('.sale-product-btn.selected');
  if (!selected) { showToast('Select a product!', 'error'); return; }
  const qty = parseInt(document.getElementById('saleQty').value) || 1;
  const method = document.getElementById('salePayment').value;
  const productId = selected.dataset.id;

  const sale = Sales.record(productId, qty, method);
  if (sale) {
    closeModal('recordSaleModal');
    document.getElementById('saleQty').value = 1;
    renderDashboard();
  }
}

// ============================================================
// DEBT MODALS
// ============================================================

function openAddDebt() {
  if (Trial.checkPaywall()) return;
  openModal('addDebtModal');
}

function submitDebt() {
  const name  = document.getElementById('debtCustomer').value.trim();
  const phone = document.getElementById('debtPhone').value.trim();
  const amount= document.getElementById('debtAmount').value;
  const desc  = document.getElementById('debtDesc').value.trim();

  if (!name || !amount) { showToast('Enter customer name and amount.', 'error'); return; }

  Debts.add({ customerName: name, phone, amount, description: desc });
  closeModal('addDebtModal');
  document.getElementById('addDebtForm').reset();
  Debts.render();
  renderDashboard();
}

function openPayDebt(id) {
  document.getElementById('payDebtId').value = id;
  openModal('payDebtModal');
}

function submitPayDebt() {
  const id     = document.getElementById('payDebtId').value;
  const amount = document.getElementById('payDebtAmount').value;
  if (!amount) { showToast('Enter amount paid.', 'error'); return; }
  Debts.markPaid(id, amount);
  closeModal('payDebtModal');
  document.getElementById('payDebtAmount').value = '';
  Debts.render();
  renderDashboard();
}

// ============================================================
// EXPENSE MODAL
// ============================================================

function openAddExpense() {
  if (Trial.checkPaywall()) return;
  openModal('addExpenseModal');
}

function submitExpense() {
  const category = document.getElementById('expenseCategory').value;
  const amount   = document.getElementById('expenseAmount').value;
  const desc     = document.getElementById('expenseDesc').value.trim();
  if (!amount) { showToast('Enter expense amount.', 'error'); return; }
  Expenses.add({ category, amount, description: desc || category });
  closeModal('addExpenseModal');
  document.getElementById('addExpenseForm').reset();
  renderDashboard();
  renderExpensesPage();
}

// ============================================================
// WITHDRAWAL MODAL
// ============================================================

function openWithdrawal() {
  openModal('withdrawalModal');
}

function submitWithdrawal() {
  const amount = document.getElementById('withdrawAmount').value;
  const note   = document.getElementById('withdrawNote').value.trim();
  if (!amount || parseFloat(amount) <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  Withdrawals.add(amount, note);
  closeModal('withdrawalModal');
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawNote').value = '';
  renderDashboard();
}

// ============================================================
// RENT SETTINGS
// ============================================================

function saveRentSettings() {
  const rent = document.getElementById('rentInput').value;
  const settings = Data.getSettings();
  settings.rent = parseFloat(rent) || 0;
  Data.saveSettings(settings);
  closeModal('rentSettingsModal');
  renderDashboard();
  renderSettings();
  showToast('Rent saved! 🏠');
}

// ============================================================
// EXPENSES PAGE RENDER
// ============================================================

function renderExpensesPage() {
  const expenses = Data.getExpenses();
  const list = document.getElementById('expenseList');
  if (!list) return;
  list.innerHTML = '';

  const todayExp = Expenses.todayTotal();
  const monthExp = Expenses.monthTotal();
  _setEl('expenseTodayTotal', fmt(todayExp));
  _setEl('expenseMonthTotal', fmt(monthExp));

  const recent = [...expenses]
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><div class="e-icon">🧾</div><div class="e-text">No expenses yet</div></div>`;
    return;
  }

  const catIcons = { Rent:'🏠', Stock:'📦', Transport:'🚗', Food:'🍽️', Airtime:'📱', Other:'📋' };

  recent.forEach(e => {
    list.innerHTML += `
      <div class="tx-item">
        <div class="tx-dot expense">${catIcons[e.category] || '📋'}</div>
        <div class="tx-info">
          <div class="tx-name">${e.description}</div>
          <div class="tx-time">${e.category} · ${Dates.format(e.createdAt)}</div>
        </div>
        <div class="tx-amount minus">-${fmt(e.amount)}</div>
      </div>`;
  });
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function openTab(tab) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add('active');

  // Show content
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  const content = document.getElementById(`tab-${tab}`);
  if (content) content.classList.add('active');

  // Render relevant data
  if (tab === 'home')     renderDashboard();
  if (tab === 'products') Products.render();
  if (tab === 'debts')    Debts.render();
  if (tab === 'expenses') renderExpensesPage();
  if (tab === 'settings') renderSettings();
}

// ============================================================
// ===== DARAJA API CONFIG =====
// M-Pesa STK Push (Lipa Na M-Pesa) Integration
// Replace with actual credentials from Safaricom Developer Portal
// https://developer.safaricom.co.ke
// ============================================================

const DARAJA = {
  // ===== DARAJA API: Replace these with your actual credentials =====
  CONSUMER_KEY:    'YOUR_CONSUMER_KEY_HERE',
  CONSUMER_SECRET: 'YOUR_CONSUMER_SECRET_HERE',
  SHORTCODE:       '174379',           // Test shortcode (replace with yours)
  PASSKEY:         'YOUR_PASSKEY_HERE',
  CALLBACK_URL:    'https://your-backend.com/api/mpesa/callback',
  ENVIRONMENT:     'sandbox',          // Change to 'production' for live
  // ===== DARAJA API: Endpoints =====
  AUTH_URL:        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
  STK_URL:         'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',

  /**
   * ===== DARAJA API: getAccessToken() =====
   * NOTE: In production, call this from YOUR BACKEND (Node.js / Firebase Functions).
   * Never expose CONSUMER_KEY / CONSUMER_SECRET in frontend JavaScript!
   * This function is here as reference only.
   */
  getAccessToken: async () => {
    // ===== BACKEND (Node.js): =====
    // const credentials = Buffer.from(`${DARAJA.CONSUMER_KEY}:${DARAJA.CONSUMER_SECRET}`).toString('base64');
    // const res = await fetch(DARAJA.AUTH_URL, { headers: { Authorization: `Basic ${credentials}` } });
    // const data = await res.json();
    // return data.access_token;
    console.warn('[DARAJA] getAccessToken() must be called from backend, not frontend.');
    return null;
  },

  /**
   * ===== DARAJA API: stkPush() =====
   * Initiates M-Pesa STK Push payment.
   * @param {string} phone - Customer phone in format 2547XXXXXXXX
   * @param {number} amount - Amount in KSh
   * @param {string} accountRef - Reference (e.g. 'BizCount Subscription')
   *
   * In production: POST to your own backend API which then calls Daraja.
   */
  stkPush: async (phone, amount, accountRef) => {
    // ===== BACKEND CALL: Replace with your actual backend endpoint =====
    // const res = await fetch('/api/mpesa/stk-push', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ phone, amount, accountRef })
    // });
    // const data = await res.json();
    // return data;

    // ===== SIMULATION (remove in production) =====
    console.log(`[DARAJA STK Push] Phone: ${phone}, Amount: KSh ${amount}, Ref: ${accountRef}`);
    return { ResponseCode: '0', CustomerMessage: 'Success. Request accepted for processing.' };
  }
};

// ============================================================
// PAYMENT FLOW
// ============================================================

async function initiatePayment() {
  const phoneInput = document.getElementById('mpesaPhone');
  if (!phoneInput) return;
  const rawPhone = phoneInput.value.replace(/\D/g,'');
  let phone = rawPhone;
  if (phone.startsWith('0')) phone = `254${phone.slice(1)}`;
  if (phone.startsWith('7') || phone.startsWith('1')) phone = `254${phone}`;

  if (phone.length < 12) {
    showToast('Enter a valid Safaricom number.', 'error');
    return;
  }

  const payBtn = document.getElementById('payNowBtn');
  if (payBtn) { payBtn.textContent = '⏳ Processing...'; payBtn.disabled = true; }

  try {
    // ===== DARAJA API: STK Push call =====
    const result = await DARAJA.stkPush(phone, APP.monthlyPrice, 'BizCount Subscription');

    if (result && result.ResponseCode === '0') {
      // ===== DARAJA API: In production, poll your backend to confirm payment =====
      // For demo, simulate success after 2 seconds
      setTimeout(() => {
        Trial.markPaid();
        closeModal('paywallModal');
        showToast('✅ Payment received! Welcome to BizCount Full.', 'success');
        Trial.renderBanner();
        renderDashboard();
        renderSettings();
        if (payBtn) { payBtn.textContent = `Pay ${APP.currency} ${APP.monthlyPrice}`; payBtn.disabled = false; }
      }, 2000);
    } else {
      showToast('Payment failed. Try again.', 'error');
      if (payBtn) { payBtn.textContent = `Pay ${APP.currency} ${APP.monthlyPrice}`; payBtn.disabled = false; }
    }
  } catch (e) {
    showToast('Network error. Check your connection.', 'error');
    if (payBtn) { payBtn.textContent = `Pay ${APP.currency} ${APP.monthlyPrice}`; payBtn.disabled = false; }
  }
}

// ============================================================
// SETTINGS SAVE
// ============================================================

function saveBusinessSettings() {
  const name = document.getElementById('settingNameInput').value.trim();
  if (!name) { showToast('Enter your business name.', 'error'); return; }
  const settings = Data.getSettings();
  settings.businessName = name;
  Data.saveSettings(settings);

  // Update user
  const user = Data.getUser();
  if (user) { user.name = name; Data.saveUser(user); }

  // Update top bar
  const topBarName = document.getElementById('topBarName');
  if (topBarName) topBarName.textContent = name;

  closeModal('businessSettingsModal');
  renderSettings();
  showToast('✅ Business name saved!');
}

// ============================================================
// AUTH FLOWS
// ============================================================

function handleLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const pin   = document.getElementById('loginPin').value.trim();
  if (!phone || !pin) { showToast('Enter your phone and PIN.', 'error'); return; }

  // ===== FIREBASE: firebase.auth() here =====
  if (Auth.login(phone, pin)) {
    initApp();
  }
}

function handleRegister() {
  const name  = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pin   = document.getElementById('regPin').value.trim();
  const pin2  = document.getElementById('regPin2').value.trim();

  if (pin !== pin2) { showToast('PINs do not match.', 'error'); return; }
  if (Auth.register(name, phone, pin)) {
    initApp();
  }
}

// ============================================================
// SAMPLE DATA (for demo/onboarding)
// ============================================================

function loadSampleData() {
  if (Data.getProducts().length > 0) return; // Already has data

  const samples = [
    { name: 'Unga (2kg)',     buyPrice: 130, sellPrice: 160, quantity: 20, lowStockAt: 5,  icon: '🌾', salesCount: 15 },
    { name: 'Sukari (1kg)',   buyPrice: 95,  sellPrice: 120, quantity: 8,  lowStockAt: 5,  icon: '🍬', salesCount: 12 },
    { name: 'Mafuta (500ml)', buyPrice: 85,  sellPrice: 110, quantity: 3,  lowStockAt: 4,  icon: '🫙', salesCount: 20 },
    { name: 'Bread (loaf)',   buyPrice: 45,  sellPrice: 65,  quantity: 15, lowStockAt: 3,  icon: '🍞', salesCount: 8  },
    { name: 'Maziwa (1L)',    buyPrice: 55,  sellPrice: 75,  quantity: 12, lowStockAt: 4,  icon: '🥛', salesCount: 6  },
  ];

  const products = samples.map(s => ({
    id: uid(), ...s,
    profit: s.sellPrice - s.buyPrice,
    createdAt: Dates.now(),
  }));
  Data.saveProducts(products);

  // Sample sale
  Sales.record(products[0].id, 3, 'cash');
  Sales.record(products[2].id, 2, 'mpesa');

  // Sample debt
  Debts.add({ customerName: 'Mary Wanjiku', phone: '0712345678', amount: 250, description: 'Unga + Mafuta' });

  // Sample settings
  const s = Data.getSettings();
  s.rent = 8000;
  Data.saveSettings(s);
}

// ============================================================
// APP INIT
// ============================================================

function initApp() {
  // ===== FIREBASE: Check auth state =====
  // firebase.auth().onAuthStateChanged((user) => { ... })

  const user = Data.getUser();
  Pages.show('appPage');

  // Set business name in top bar
  const settings = Data.getSettings();
  const topBarName = document.getElementById('topBarName');
  if (topBarName) topBarName.textContent = settings.businessName || 'My Shop';

  // Load demo data if first time
  loadSampleData();

  // Init trial
  Trial.init();
  Trial.renderBanner();

  // Render default tab
  openTab('home');
}

// ============================================================
// DOCUMENT READY
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ===== FIREBASE: Initialize Firebase here =====
  // import { initializeApp } from 'firebase/app';
  // const app = initializeApp(firebaseConfig);

  // Check if user is logged in
  if (Auth.isLoggedIn()) {
    initApp();
  } else {
    Pages.show('loginPage');
  }

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Paywall close
  const paywallOverlay = document.getElementById('paywallModal');
  if (paywallOverlay) {
    paywallOverlay.addEventListener('click', (e) => {
      if (e.target === paywallOverlay) paywallOverlay.classList.remove('open');
    });
  }
});
