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
  getSettings:   () => DB.get('settings',   { rent: 0, businessName: 'My Shop', phone: '', restockFund: 200, dailyRentSaving: 0 }),
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
// ICON LIBRARY
// ============================================================

const PRODUCT_ICONS = [
  '📦','🌾','🍬','🫙','🍞','🥛','🥩','🥬','🧅','🧄',
  '🍅','🍋','🍌','🍎','🍇','🥑','🌽','🥕','🫘','🧃',
  '🥤','☕','🍫','🍭','🧂','🧴','🧹','🧺','🧻','🪣',
  '👗','👟','👔','🧢','👜','🕶️','⌚','📱','💊','🩺',
  '🔑','🪑','💡','🔋','🖊️','📚','🧷','🪡','🌸','🎀',
  '🏪','🛒','💰','🤝','🎁','🚗','⭐','🔥','💎','🌟',
];

// ============================================================
// ICON PICKER RENDERER
// ============================================================

function renderIconPicker(gridId, previewId, hiddenInputId, selectedIcon = '📦') {
  const grid = document.getElementById(gridId);
  const preview = document.getElementById(previewId);
  const input = document.getElementById(hiddenInputId);
  if (!grid) return;

  grid.innerHTML = '';
  PRODUCT_ICONS.forEach(icon => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `icon-picker-btn${icon === selectedIcon ? ' selected' : ''}`;
    btn.textContent = icon;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.icon-picker-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (preview) preview.textContent = icon;
      if (input)   input.value = icon;
    });
    grid.appendChild(btn);
  });

  if (preview) preview.textContent = selectedIcon;
  if (input)   input.value = selectedIcon;
}

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
    // ===== FIREBASE: sync trial/payment status =====
    if (window.Firebase) window.Firebase.cloud.saveTrial(trial);
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
// AUTH SYSTEM — Firebase backed
// ============================================================

const Auth = {
  isLoggedIn: () => !!Data.getUser(),

  login: async (phone, pin) => {
    if (!phone || !pin) { showToast('Enter your phone and PIN.', 'error'); return; }
    // ===== FIREBASE: signInWithEmailAndPassword =====
    const result = await window.Firebase.login(phone, pin);
    if (result.ok) {
      // onAuthStateChanged in firebase.js will call initApp() automatically
      showToast('Welcome back! 👋', 'success');
    } else {
      showToast(result.error, 'error');
    }
  },

  register: async (name, phone, pin) => {
    if (!name || !phone || !pin) { showToast('Please fill all fields.', 'error'); return; }
    if (pin.length < 4) { showToast('PIN must be 4 digits.', 'error'); return; }
    // ===== FIREBASE: createUserWithEmailAndPassword =====
    const result = await window.Firebase.register(name, phone, pin);
    if (result.ok) {
      showToast(`Account created! Welcome, ${result.name} 🎉`, 'success');
      // onAuthStateChanged in firebase.js will call initApp() automatically
    } else {
      showToast(result.error, 'error');
    }
  },

  logout: async () => {
    // ===== FIREBASE: signOut =====
    await window.Firebase.logout();
    Pages.show('loginPage');
    showToast('Logged out. See you soon! 👋', 'info');
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
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveProduct(product);
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
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveProduct(products[idx]);
    return true;
  },

  delete: (id) => {
    const products = Data.getProducts().filter(p => p.id !== id);
    Data.saveProducts(products);
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.deleteProduct(id);
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

    // Stock value totals
    const totalCost    = products.reduce((s, p) => s + (p.quantity * p.buyPrice),  0);
    const totalSellVal = products.reduce((s, p) => s + (p.quantity * p.sellPrice), 0);
    _setEl('prodStockCost',    fmt(totalCost));
    _setEl('prodStockSellVal', fmt(totalSellVal));

    if (!products.length) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    products.forEach((p, i) => {
      const isLow  = Products.isLowStock(p);
      const isFast = Products.isFastMoving(p);
      const stockCostVal = p.quantity * p.buyPrice;

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
          <div class="p-meta">Buy: ${fmt(p.buyPrice)} · Sell: ${fmt(p.sellPrice)} · Profit: <strong style="color:var(--green)">+${fmt(p.profit)}</strong></div>
          <div class="p-meta" style="margin-top:3px">Stock: <strong>${p.quantity} units</strong> · Value: <span style="color:var(--blue);font-weight:700">${fmt(stockCostVal)}</span></div>
          <div class="p-meta" style="margin-top:4px">${badge}</div>
        </div>
        <div class="product-right">
          <button class="btn btn-sm btn-secondary" style="margin-bottom:4px" onclick="openEditProduct('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-outline" onclick="openRestockModal('${p.id}')">📦 Restock</button>
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

    // ===== FIREBASE: sync sale to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveSale(sale);
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

  // Cost of goods sold today (buying price × qty) — what you paid for the stock you sold
  todayCOGS: () => {
    const today = Dates.today();
    return Data.getSales()
      .filter(s => s.date === today)
      .reduce((sum, s) => sum + (s.buyPrice * s.qty), 0);
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
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveDebt(debt);
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
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveDebt(debt);
    showToast(debt.status === 'paid' ? `✅ ${debt.customerName} cleared their debt!` : `💸 Partial payment recorded.`);
    return true;
  },

  delete: (id) => {
    const debts = Data.getDebts().filter(d => d.id !== id);
    Data.saveDebts(debts);
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.deleteDebt(id);
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
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveExpense(expense);
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
// DAILY SAVINGS TRACKER
// Rent savings + Restock fund are set aside from daily profit
// ============================================================

const DailySavings = {
  // Get today's savings records (rent + restock)
  getAll: () => DB.get('daily_savings', []),
  saveAll: (d) => DB.set('daily_savings', d),

  // Record that savings were set aside today
  setAsideToday: () => {
    const settings = Data.getSettings();
    const rentDaily   = parseFloat(settings.dailyRentSaving) || RentTracker.dailySavingsNeeded();
    const restockDaily= parseFloat(settings.restockFund) || 0;
    const today = Dates.today();
    const all = DailySavings.getAll();

    // Don't double-record same day
    if (all.find(s => s.date === today)) return;

    all.push({
      id: uid(),
      date: today,
      rentAmount: rentDaily,
      restockAmount: restockDaily,
      total: rentDaily + restockDaily,
      createdAt: Dates.now(),
    });
    DailySavings.saveAll(all);
    // ===== FIREBASE: sync daily saving =====
    const latest = all[all.length - 1];
    if (window.Firebase) window.Firebase.cloud.saveDailySaving(latest);
  },

  todayRecord: () => {
    return DailySavings.getAll().find(s => s.date === Dates.today()) || null;
  },

  todayRentSaving: () => {
    const r = DailySavings.todayRecord();
    return r ? r.rentAmount : 0;
  },

  todayRestockSaving: () => {
    const r = DailySavings.todayRecord();
    return r ? r.restockAmount : 0;
  },

  todayTotal: () => {
    const r = DailySavings.todayRecord();
    return r ? r.total : 0;
  },

  // Total rent saved this month (from daily_savings records)
  monthRentSaved: () => {
    const month = Dates.today().slice(0, 7);
    return DailySavings.getAll()
      .filter(s => s.date.startsWith(month))
      .reduce((sum, s) => sum + s.rentAmount, 0);
  },

  // Total restock fund this month
  monthRestockSaved: () => {
    const month = Dates.today().slice(0, 7);
    return DailySavings.getAll()
      .filter(s => s.date.startsWith(month))
      .reduce((sum, s) => sum + s.restockAmount, 0);
  },
};

// ============================================================
// RENT / SAVINGS TRACKER
// ============================================================

const RentTracker = {
  dailySavingsNeeded: () => {
    const settings = Data.getSettings();
    const rent = parseFloat(settings.rent) || 0;
    // If user set a manual daily amount, use that
    if (settings.dailyRentSaving && settings.dailyRentSaving > 0) {
      return parseFloat(settings.dailyRentSaving);
    }
    const daysLeft = Dates.daysInMonth() - Dates.dayOfMonth() + 1;
    return daysLeft > 0 ? Math.ceil(rent / daysLeft) : rent;
  },

  monthSaved: () => {
    // Count days user tapped "I Saved Today" × daily saving
    // RentSavings is defined later in the file so we reference via function
    const records  = DB.get('rent_saved_days', []);
    const month    = Dates.today().slice(0, 7);
    const daysSaved= records.filter(d => d.startsWith(month)).length;
    const dailyAmt = RentTracker.dailySavingsNeeded();
    return daysSaved * dailyAmt;
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
    const entry = { id: uid(), amount: parseFloat(amount)||0, note, date: Dates.today(), createdAt: Dates.now() };
    w.push(entry);
    Data.saveWithdrawals(w);
    // ===== FIREBASE: sync to Firestore =====
    if (window.Firebase) window.Firebase.cloud.saveWithdrawal(entry);
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
  const settings = Data.getSettings();

  // ── THE 5 NUMBERS ────────────────────────────────────────
  const revenue   = Sales.todayRevenue();
  const stockCost = Sales.todayCOGS();
  const netProfit = revenue - stockCost;
  const rentSave  = RentTracker.dailySavingsNeeded();

  // Only deduct rent saving if user has already tapped "I Saved Today"
  const savedToday    = RentSavings.savedToday();
  const rentDeducted  = savedToday ? rentSave : 0;
  const cashCanUse    = netProfit - rentDeducted;

  // ── MONTH numbers ────────────────────────────────────────
  const monthProfit   = Sales.monthTotal();
  const totalDebt     = Debts.totalOwed();
  const todayExpenses = Expenses.todayTotal();
  const rent          = parseFloat(settings.rent) || 0;
  const monthSaved    = RentTracker.monthSaved();
  const rentProgress  = RentTracker.rentProgress();
  const daysLeft      = Dates.daysInMonth() - Dates.dayOfMonth() + 1;

  // ── Stock value ──────────────────────────────────────────
  const products  = Data.getProducts();
  const stockValue= products.reduce((s, p) => s + (p.quantity * p.buyPrice), 0);

  // ── Hero ─────────────────────────────────────────────────
  _setEl('heroProfitNum', fmt(netProfit));
  _setEl('heroSub', netProfit >= 0 ? 'Revenue minus stock cost' : 'Stock cost exceeded revenue today');
  const heroDate = document.getElementById('heroDate');
  if (heroDate) heroDate.textContent = new Date().toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long' });
  const hero = document.getElementById('heroCard');
  if (hero) hero.style.background = netProfit >= 0
    ? 'linear-gradient(135deg, var(--green) 0%, #0F5230 100%)'
    : 'linear-gradient(135deg, #C0392B 0%, #922B21 100%)';

  // ── 5-line money card ────────────────────────────────────
  _setEl('bdRevenue',   fmt(revenue));
  _setEl('bdCOGS',     `-${fmt(stockCost)}`);
  _setEl('bdNetProfit', fmt(netProfit));
  _setEl('bdRentSave',  savedToday ? `-${fmt(rentSave)}` : `${fmt(rentSave)} (not saved yet)`);
  _setEl('bdCanUse',    fmt(cashCanUse));

  const netRow = document.getElementById('netProfitRow');
  if (netRow) netRow.style.background = netProfit >= 0 ? '#F0FAF4' : '#FEF0F0';
  const netVal = document.getElementById('bdNetProfit');
  if (netVal) netVal.style.color = netProfit >= 0 ? 'var(--green)' : 'var(--red)';
  const cashRow = document.getElementById('cashUseRow');
  if (cashRow) cashRow.style.background = cashCanUse >= 0 ? 'var(--green)' : 'var(--red)';

  // ── Rent formula display ─────────────────────────────────
  _setEl('rfRent',  fmt(rent));
  _setEl('rfDays',  daysLeft);
  _setEl('rfDaily', fmt(rentSave));
  _setEl('savedTodayAmt', fmt(rentSave));

  // ── Rent progress bar ────────────────────────────────────
  _setEl('rentProgressLabel', `${fmt(monthSaved)} / ${fmt(rent)} saved`);
  _setEl('rentProgressPct',   `${rentProgress}%`);
  const fill = document.getElementById('rentProgressFill');
  if (fill) {
    fill.style.width = `${rentProgress}%`;
    fill.className = `progress-fill ${rentProgress < 50 ? 'danger' : rentProgress < 80 ? 'gold' : ''}`;
  }

  // ── I Saved Today button state ───────────────────────────
  RentSavings.renderSavedTodayButton();

  // ── Stat strip ───────────────────────────────────────────
  _setEl('statExpenses',    fmt(todayExpenses));
  _setEl('statDebt',        fmt(totalDebt));
  _setEl('statMonthProfit', fmt(monthProfit));
  _setEl('statStockVal',    fmt(stockValue));

  // ── Month split ──────────────────────────────────────────
  const businessMoney = Math.max(0, monthProfit - Expenses.monthTotal()
    - Withdrawals.monthTotal() - monthSaved);
  _setEl('cfBusiness',  fmt(businessMoney));
  _setEl('cfPersonal',  fmt(Withdrawals.monthTotal()));
  _setEl('cfRentSaved', fmt(monthSaved));
  _setEl('cfStockVal',  fmt(stockValue));

  renderRecentActivity();
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
  _setEl('settingRestockDisplay', fmt(settings.restockFund || 0));

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
  renderIconPicker('iconPickerGrid', 'selectedIconPreview', 'newProductIcon', '📦');
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
  renderIconPicker('editIconPickerGrid', 'editSelectedIconPreview', 'editProductIcon', p.icon || '📦');
  openModal('editProductModal');
}

function submitAddProduct() {
  const name  = document.getElementById('newProductName').value.trim();
  const buy   = document.getElementById('newBuyPrice').value;
  const sell  = document.getElementById('newSellPrice').value;
  const qty   = document.getElementById('newQuantity').value;
  const low   = document.getElementById('newLowStock').value || 5;
  const icon  = document.getElementById('newProductIcon').value || '📦';

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
  const icon = document.getElementById('editProductIcon').value || '📦';

  if (!name || !buy || !sell) { showToast('Please fill all fields.', 'error'); return; }
  Products.update(id, { name, icon, buyPrice: parseFloat(buy), sellPrice: parseFloat(sell), quantity: parseInt(qty), lowStockAt: parseInt(low) });
  closeModal('editProductModal');
  Products.render();
  renderDashboard();
  showToast('✅ Product updated!');
}

// ============================================================
// RESTOCK FUNCTIONS
// ============================================================

// Open restock picker — shows a product list to choose which to restock
function openRestockPicker() {
  if (Trial.checkPaywall()) return;
  const products = Data.getProducts();
  if (!products.length) { showToast('No products yet. Add products first.', 'error'); return; }

  // Build a quick-select sheet by repurposing the sale product grid
  const grid = document.getElementById('saleProductGrid');
  if (!grid) return;
  grid.innerHTML = '';

  products.forEach(p => {
    const btn = document.createElement('div');
    btn.className = 'sale-product-btn';
    btn.dataset.id = p.id;
    const isLow = Products.isLowStock(p);
    btn.innerHTML = `
      <div style="font-size:1.5rem">${p.icon}</div>
      <div class="spb-name">${p.name}</div>
      <div class="spb-price">Stock: ${p.quantity} ${isLow ? '⚠️' : '✅'}</div>`;
    btn.addEventListener('click', () => {
      closeModal('recordSaleModal');
      openRestockModal(p.id);
    });
    grid.appendChild(btn);
  });

  // Reuse the sale modal but with different title
  const title = document.querySelector('#recordSaleModal .modal-title');
  if (title) title.textContent = '📦 Select Product to Restock';
  const footer = document.getElementById('saleModalFooter');

  openModal('recordSaleModal');
}

// Open restock modal for a specific product
function openRestockModal(productId) {
  const p = Products.getById(productId);
  if (!p) return;

  document.getElementById('restockProductId').value = p.id;
  document.getElementById('restockIcon').textContent  = p.icon;
  document.getElementById('restockName').textContent  = p.name;
  document.getElementById('restockCurrentStock').textContent = `Current stock: ${p.quantity} units`;
  document.getElementById('restockQty').value = '';
  document.getElementById('restockCost').value = '';
  document.getElementById('restockPreview').textContent = `New total stock will show here`;

  // Live preview as user types
  const qtyInput = document.getElementById('restockQty');
  qtyInput.oninput = () => {
    const added = parseInt(qtyInput.value) || 0;
    const newTotal = p.quantity + added;
    document.getElementById('restockPreview').textContent =
      added > 0 ? `✅ New stock: ${p.quantity} + ${added} = ${newTotal} units` : 'New total stock will show here';
  };

  openModal('restockModal');
}

// Open restock directly from the edit product modal
function openRestockFromEdit() {
  const id = document.getElementById('editProductId').value;
  closeModal('editProductModal');
  setTimeout(() => openRestockModal(id), 200);
}

function submitRestock() {
  const id   = document.getElementById('restockProductId').value;
  const qty  = parseInt(document.getElementById('restockQty').value);
  const cost = parseFloat(document.getElementById('restockCost').value) || 0;
  const p    = Products.getById(id);

  if (!qty || qty <= 0) { showToast('Enter the number of units added.', 'error'); return; }

  const newQty = p.quantity + qty;
  Products.update(id, { quantity: newQty });

  // Log as an expense if cost was entered
  if (cost > 0) {
    Expenses.add({ category: 'Stock', description: `Restocked ${p.name} (×${qty})`, amount: cost });
  }

  closeModal('restockModal');
  Products.render();
  renderDashboard();
  showToast(`📦 ${p.name} restocked! +${qty} units → ${newQty} total`);
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

function openRentSettings() {
  const settings = Data.getSettings();
  const ri = document.getElementById('rentInput');
  const rd = document.getElementById('rentDailyInput');
  const rf = document.getElementById('restockFundInput');
  if (ri) ri.value = settings.rent || '';
  if (rd) rd.value = settings.dailyRentSaving || '';
  if (rf) rf.value = settings.restockFund !== undefined ? settings.restockFund : 200;
  openModal('rentSettingsModal');
}

function saveRentSettings() {
  const rent        = parseFloat(document.getElementById('rentInput').value) || 0;
  const dailyManual = parseFloat(document.getElementById('rentDailyInput')?.value) || 0;
  const restock     = parseFloat(document.getElementById('restockFundInput')?.value) || 0;

  const settings = Data.getSettings();
  settings.rent           = rent;
  settings.dailyRentSaving= dailyManual;
  settings.restockFund    = restock;
  Data.saveSettings(settings);
  // ===== FIREBASE: sync settings =====
  if (window.Firebase) window.Firebase.cloud.saveSettings(settings);

  closeModal('rentSettingsModal');
  renderDashboard();
  renderSettings();
  showToast('✅ Savings settings saved! 🏠');
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
  // ===== FIREBASE: sync settings =====
  if (window.Firebase) window.Firebase.cloud.saveSettings(settings);

  const user = Data.getUser();
  if (user) { user.name = name; Data.saveUser(user); }

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
  Auth.login(phone, pin); // async — Firebase onAuthStateChanged triggers initApp()
}

function handleRegister() {
  const name  = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pin   = document.getElementById('regPin').value.trim();
  const pin2  = document.getElementById('regPin2').value.trim();

  if (pin !== pin2) { showToast('PINs do not match.', 'error'); return; }
  Auth.register(name, phone, pin); // async — Firebase onAuthStateChanged triggers initApp()
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
// EXPORT / REPORT FUNCTIONS
// ============================================================

function getExportDateRange() {
  const period = document.getElementById('exportPeriod')?.value || 'month';
  const today  = Dates.today();
  const month  = today.slice(0, 7);
  if (period === 'today') return { label: `Today (${today})`,  filter: (d) => d === today };
  if (period === 'month') return { label: `Month of ${month}`, filter: (d) => d.startsWith(month) };
  return { label: 'All Time', filter: () => true };
}

// Download CSV file (opens in Excel / Google Sheets)
function exportCSV() {
  const { label, filter } = getExportDateRange();
  const settings  = Data.getSettings();
  const bizName   = settings.businessName || 'My Shop';
  const sales     = Data.getSales().filter(s => filter(s.date));
  const expenses  = Data.getExpenses().filter(e => filter(e.date));
  const debts     = Data.getDebts();
  const products  = Data.getProducts();

  let csv = '';

  // ---- Summary Sheet ----
  const totalRevenue = sales.reduce((s, r) => s + r.revenue, 0);
  const totalProfit  = sales.reduce((s, r) => s + r.profit,  0);
  const totalExpenses= expenses.reduce((s, e) => s + e.amount, 0);
  const totalDebt    = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  csv += `BIZCOUNT BUSINESS REPORT\n`;
  csv += `Business,${bizName}\n`;
  csv += `Period,${label}\n`;
  csv += `Generated,${new Date().toLocaleString('en-KE')}\n\n`;

  csv += `SUMMARY\n`;
  csv += `Total Revenue,KSh ${totalRevenue.toLocaleString()}\n`;
  csv += `Total Profit,KSh ${totalProfit.toLocaleString()}\n`;
  csv += `Total Expenses,KSh ${totalExpenses.toLocaleString()}\n`;
  csv += `Net Profit,KSh ${(totalProfit - totalExpenses).toLocaleString()}\n`;
  csv += `Outstanding Debt,KSh ${totalDebt.toLocaleString()}\n\n`;

  // ---- Sales ----
  csv += `SALES (${sales.length} transactions)\n`;
  csv += `Date,Product,Qty,Selling Price,Revenue,Profit,Payment\n`;
  sales.forEach(s => {
    csv += `${s.date},"${s.productName}",${s.qty},${s.sellPrice},${s.revenue},${s.profit},${s.paymentMethod}\n`;
  });
  csv += '\n';

  // ---- Expenses ----
  csv += `EXPENSES (${expenses.length} entries)\n`;
  csv += `Date,Category,Description,Amount\n`;
  expenses.forEach(e => {
    csv += `${e.date},${e.category},"${e.description}",${e.amount}\n`;
  });
  csv += '\n';

  // ---- Products ----
  csv += `PRODUCTS (${products.length} items)\n`;
  csv += `Name,Buy Price,Sell Price,Profit Per Unit,Current Stock\n`;
  products.forEach(p => {
    csv += `"${p.name}",${p.buyPrice},${p.sellPrice},${p.profit},${p.quantity}\n`;
  });
  csv += '\n';

  // ---- Debts ----
  const activeDebts = debts.filter(d => d.status !== 'paid');
  csv += `OUTSTANDING DEBTS (${activeDebts.length})\n`;
  csv += `Customer,Amount Owed,Paid,Remaining,Status,Date\n`;
  activeDebts.forEach(d => {
    csv += `"${d.customerName}",${d.amount},${d.paidAmount},${d.amount - d.paidAmount},${d.status},${d.date}\n`;
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `BizCount_${bizName.replace(/\s+/g,'_')}_${label.replace(/\s+/g,'_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  closeModal('exportModal');
  showToast('✅ CSV downloaded! Open in Excel or Google Sheets.', 'success');
}

// Generate printable HTML report (print to PDF from browser)
function exportPrintReport() {
  const { label, filter } = getExportDateRange();
  const settings  = Data.getSettings();
  const bizName   = settings.businessName || 'My Shop';
  const sales     = Data.getSales().filter(s => filter(s.date));
  const expenses  = Data.getExpenses().filter(e => filter(e.date));
  const debts     = Data.getDebts().filter(d => d.status !== 'paid');
  const products  = Data.getProducts();

  const totalRevenue  = sales.reduce((s, r) => s + r.revenue, 0);
  const totalProfit   = sales.reduce((s, r) => s + r.profit,  0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit     = totalProfit - totalExpenses;
  const totalDebt     = debts.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  const salesRows = sales.map(s => `
    <tr>
      <td>${s.date}</td><td>${s.productName}</td><td>${s.qty}</td>
      <td>KSh ${s.revenue.toLocaleString()}</td>
      <td style="color:#1A7A4A;font-weight:700">KSh ${s.profit.toLocaleString()}</td>
      <td>${s.paymentMethod === 'mpesa' ? '📱 M-Pesa' : '💵 Cash'}</td>
    </tr>`).join('');

  const expenseRows = expenses.map(e => `
    <tr>
      <td>${e.date}</td><td>${e.category}</td><td>${e.description}</td>
      <td style="color:#E03B3B;font-weight:700">KSh ${e.amount.toLocaleString()}</td>
    </tr>`).join('');

  const debtRows = debts.map(d => `
    <tr>
      <td>${d.customerName}</td><td>${d.description || '—'}</td>
      <td style="color:#E03B3B;font-weight:700">KSh ${(d.amount - d.paidAmount).toLocaleString()}</td>
      <td><span style="color:#E03B3B;font-weight:800;text-transform:uppercase;font-size:0.75rem">${d.status}</span></td>
    </tr>`).join('');

  const productRows = products.map(p => `
    <tr>
      <td>${p.icon} ${p.name}</td>
      <td>KSh ${p.buyPrice.toLocaleString()}</td>
      <td>KSh ${p.sellPrice.toLocaleString()}</td>
      <td style="color:#1A7A4A;font-weight:700">KSh ${p.profit.toLocaleString()}</td>
      <td>${p.quantity} ${Products.isLowStock(p) ? '<span style="color:#E03B3B;font-weight:800">⚠️ LOW</span>' : '✅'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>BizCount Report — ${bizName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1A1D23; padding: 24px; max-width: 900px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1A7A4A; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 1.6rem; color: #1A7A4A; }
  .header h1 span { color: #F5A623; }
  .header .meta { text-align: right; color: #666; font-size: 0.82rem; }
  .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px; }
  .sum-box { background: #F5F7FA; border-radius: 8px; padding: 12px; text-align: center; border-top: 3px solid #1A7A4A; }
  .sum-box.red { border-color: #E03B3B; }
  .sum-box.gold { border-color: #F5A623; }
  .sum-box .sl { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: #8A95A3; margin-bottom: 4px; }
  .sum-box .sv { font-size: 1.1rem; font-weight: 900; color: #1A1D23; }
  .sum-box.red .sv { color: #E03B3B; }
  .sum-box .net { color: ${netProfit >= 0 ? '#1A7A4A' : '#E03B3B'}; }
  section { margin-bottom: 24px; }
  section h2 { font-size: 1rem; font-weight: 800; color: #1A7A4A; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { background: #1A7A4A; color: white; padding: 7px 10px; text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 7px 10px; border-bottom: 1px solid #F0F0F0; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .empty { color: #8A95A3; font-style: italic; padding: 10px; }
  .footer { margin-top: 30px; border-top: 1px solid #E2E8F0; padding-top: 12px; text-align: center; color: #8A95A3; font-size: 0.75rem; }
  @media print {
    body { padding: 0; }
    button { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Biz<span>Count</span> 💰</h1>
    <div style="font-size:1rem;font-weight:700;margin-top:2px">${bizName}</div>
  </div>
  <div class="meta">
    <div style="font-weight:800;font-size:0.9rem">Business Report</div>
    <div>${label}</div>
    <div style="margin-top:4px">Generated: ${new Date().toLocaleString('en-KE')}</div>
  </div>
</div>

<div class="summary">
  <div class="sum-box"><div class="sl">Revenue</div><div class="sv">KSh ${totalRevenue.toLocaleString()}</div></div>
  <div class="sum-box"><div class="sl">Gross Profit</div><div class="sv">KSh ${totalProfit.toLocaleString()}</div></div>
  <div class="sum-box red"><div class="sl">Expenses</div><div class="sv">KSh ${totalExpenses.toLocaleString()}</div></div>
  <div class="sum-box"><div class="sl">Net Profit</div><div class="sv net">KSh ${netProfit.toLocaleString()}</div></div>
  <div class="sum-box red"><div class="sl">Debts Owed</div><div class="sv">KSh ${totalDebt.toLocaleString()}</div></div>
</div>

<section>
  <h2>📦 Products (${products.length})</h2>
  ${products.length ? `
  <table>
    <tr><th>Product</th><th>Buy Price</th><th>Sell Price</th><th>Profit/Unit</th><th>Stock</th></tr>
    ${productRows}
  </table>` : '<p class="empty">No products added yet.</p>'}
</section>

<section>
  <h2>💰 Sales (${sales.length} transactions)</h2>
  ${sales.length ? `
  <table>
    <tr><th>Date</th><th>Product</th><th>Qty</th><th>Revenue</th><th>Profit</th><th>Payment</th></tr>
    ${salesRows}
  </table>` : '<p class="empty">No sales recorded for this period.</p>'}
</section>

<section>
  <h2>🧾 Expenses (${expenses.length} entries)</h2>
  ${expenses.length ? `
  <table>
    <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>
    ${expenseRows}
  </table>` : '<p class="empty">No expenses recorded for this period.</p>'}
</section>

<section>
  <h2>📝 Outstanding Debts / Madeni (${debts.length})</h2>
  ${debts.length ? `
  <table>
    <tr><th>Customer</th><th>Items</th><th>Remaining</th><th>Status</th></tr>
    ${debtRows}
  </table>` : '<p class="empty">No outstanding debts. 🎉</p>'}
</section>

<div class="footer">
  BizCount v1.0 · Made for Kenya 🇰🇪 · Report generated on ${new Date().toLocaleString('en-KE')}
</div>

<br/>
<button onclick="window.print()" style="background:#1A7A4A;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:0.95rem;font-weight:800;cursor:pointer;display:block;margin:0 auto">
  🖨️ Print / Save as PDF
</button>

</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Allow pop-ups to view the report.', 'error');
  }

  closeModal('exportModal');
}

// ============================================================
// RENT SAVINGS — "I Saved Today" system
// Deducts rent saving from profit when user taps the button
// ============================================================

const RentSavings = {
  // Check if user already tapped "I Saved Today" for today
  savedToday: () => {
    const records = DB.get('rent_saved_days', []);
    return records.includes(Dates.today());
  },

  // Mark today as saved — deducts from profit tracking
  markToday: () => {
    const records = DB.get('rent_saved_days', []);
    if (!records.includes(Dates.today())) {
      records.push(Dates.today());
      DB.set('rent_saved_days', records);
    }
    // Also log in DailySavings for rent progress bar
    DailySavings.setAsideToday();
  },

  // Count of days saved this month
  daysSavedThisMonth: () => {
    const month = Dates.today().slice(0, 7);
    const records = DB.get('rent_saved_days', []);
    return records.filter(d => d.startsWith(month)).length;
  },

  // Render the button state (saved vs not saved)
  renderSavedTodayButton: () => {
    const btn     = document.getElementById('savedTodayBtn');
    const confirm = document.getElementById('savedTodayConfirm');
    const msg     = document.getElementById('savedTodayMsg');
    if (!btn || !confirm) return;

    const saved      = RentSavings.savedToday();
    const daysSaved  = RentSavings.daysSavedThisMonth();
    const daysInMonth= Dates.daysInMonth();

    if (saved) {
      btn.classList.add('hidden');
      confirm.classList.remove('hidden');
      if (msg) msg.textContent = `${daysSaved} of ${daysInMonth} days saved this month 🎯`;
    } else {
      btn.classList.remove('hidden');
      confirm.classList.add('hidden');
    }
  }
};

function markRentSavedToday() {
  const rentSave = RentTracker.dailySavingsNeeded();
  if (rentSave <= 0) {
    showToast('Set your monthly rent first in Settings.', 'error');
    openRentSettings();
    return;
  }
  RentSavings.markToday();
  showToast(`🏠 KSh ${rentSave.toLocaleString()} saved for rent today!`, 'success');
  renderDashboard();
}

// ============================================================
// RENT SETTINGS — save from settings tab inline form
// ============================================================

function previewRentCalc() {
  const rent     = parseFloat(document.getElementById('settingsRentInput')?.value) || 0;
  const daysLeft = Dates.daysInMonth() - Dates.dayOfMonth() + 1;
  const daily    = rent > 0 ? Math.ceil(rent / daysLeft) : 0;
  _setEl('rfRent',  fmt(rent));
  _setEl('rfDays',  daysLeft);
  _setEl('rfDaily', fmt(daily));
}

function saveRentFromSettings() {
  const rent  = parseFloat(document.getElementById('settingsRentInput')?.value) || 0;
  const daily = parseFloat(document.getElementById('settingsRentDailyInput')?.value) || 0;
  const settings = Data.getSettings();
  settings.rent            = rent;
  settings.dailyRentSaving = daily;
  Data.saveSettings(settings);
  if (window.Firebase) window.Firebase.cloud.saveSettings(settings);
  renderDashboard();
  renderSettings();
  showToast('✅ Rent settings saved! 🏠', 'success');
}

// ============================================================
// RENDER SETTINGS TAB
// ============================================================

function renderSettings() {
  const settings = Data.getSettings();
  const user     = Data.getUser();
  _setEl('settingBusinessName', settings.businessName || 'My Shop');
  _setEl('settingPhone', user ? user.phone : '');

  // Pre-fill rent inputs
  const ri = document.getElementById('settingsRentInput');
  const rd = document.getElementById('settingsRentDailyInput');
  if (ri && !ri.value) ri.value = settings.rent || '';
  if (rd && !rd.value) rd.value = settings.dailyRentSaving || '';

  // Rent calculator display
  const rent     = parseFloat(settings.rent) || 0;
  const daysLeft = Dates.daysInMonth() - Dates.dayOfMonth() + 1;
  const daily    = settings.dailyRentSaving > 0
    ? settings.dailyRentSaving
    : (rent > 0 ? Math.ceil(rent / daysLeft) : 0);

  _setEl('rfRent',  fmt(rent));
  _setEl('rfDays',  daysLeft);
  _setEl('rfDaily', fmt(daily));

  // Settings rent progress
  const monthSaved   = RentTracker.monthSaved();
  const rentProgress = RentTracker.rentProgress();
  _setEl('settingsRentProgressLabel', `${fmt(monthSaved)} / ${fmt(rent)} saved this month`);
  _setEl('settingsRentProgressPct',   `${rentProgress}%`);
  const sf = document.getElementById('settingsRentFill');
  if (sf) {
    sf.style.width     = `${rentProgress}%`;
    sf.className       = `progress-fill ${rentProgress < 50 ? 'danger' : rentProgress < 80 ? 'gold' : ''}`;
  }

  // Days saved
  const records   = DB.get('rent_saved_days', []);
  const month     = Dates.today().slice(0, 7);
  const daysSaved = records.filter(d => d.startsWith(month)).length;
  _setEl('settingsDaysSaved', `${daysSaved} of ${Dates.daysInMonth()} days`);

  // Subscription
  const trial    = Data.getTrial();
  const statusEl = document.getElementById('subscriptionStatus');
  if (statusEl) {
    if (Trial.isPaid()) {
      statusEl.innerHTML = `<span style="color:var(--green);font-weight:800">✅ Active — Full Access</span>`;
    } else if (Trial.daysLeft() > 0) {
      statusEl.innerHTML = `<span style="color:var(--gold);font-weight:800">🎁 Free Trial — ${Trial.daysLeft()} day(s) left</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:var(--red);font-weight:800">🔒 Trial Expired — Upgrade</span>`;
    }
  }

  // Staff status
  const staffAcc = DB.get('staff_account', null);
  _setEl('staffStatusLabel', staffAcc ? `Staff: ${staffAcc.name}` : 'No staff account yet');

  // SMS status
  const smsS = DB.get('sms_settings', {});
  _setEl('smsStatusLabel', smsS.enabled && smsS.phone1 ? `Active — ${smsS.time} daily` : 'Not configured');
}
// Highlights real elements live on the page
// ============================================================

const TOUR_STEPS = [
  {
    target: null,
    tab: 'home',
    icon: '👋',
    title: 'Welcome to BizCount!',
    body: 'This is your business tracker. I will show you exactly how everything works — live on the actual screen. Follow me!',
    tip: '💡 Tap Next to move through the tour. Tap Skip any time.',
  },
  {
    target: 'heroCard',
    tab: 'home',
    icon: '📈',
    title: 'Net Profit — Right Here',
    body: 'This green card shows your net profit for today. It is calculated as: money collected from sales minus the cost of goods you sold.',
    tip: '💡 If it turns red, your stock cost was more than what you earned.',
  },
  {
    target: 'bdCanUse',
    tab: 'home',
    icon: '✅',
    title: 'Cash You Can Use',
    body: 'This is the most important number. Net profit minus rent savings = the money you are free to spend or take home today.',
    tip: '💡 Never spend more than this amount on personal things.',
  },
  {
    target: 'savedTodayBtn',
    tab: 'home',
    icon: '🏠',
    title: '"I Saved Today" Button',
    body: 'Every day, tap this button to confirm you have set aside your rent money. It deducts from your profit and tracks your monthly rent progress.',
    tip: '💡 Set your rent amount in Settings → Rent Savings Calculator.',
  },
  {
    target: null,
    tab: 'products',
    navTarget: '[data-tab="products"]',
    icon: '📦',
    title: 'Products Tab — Add Your Items',
    body: 'This is where you add every item you sell. Enter the buying price and selling price — BizCount calculates your profit per item automatically.',
    tip: '💡 Example: Unga — Buy KSh 130, Sell KSh 160 = KSh 30 profit each.',
  },
  {
    target: 'prodStockCost',
    tab: 'products',
    icon: '🏪',
    title: 'Money Tied Up in Stock',
    body: 'This box shows how much money you have locked inside your shelf goods. It only becomes profit when you sell those items.',
    tip: '💡 High stock value + low sales = you need to sell more, not buy more.',
  },
  {
    target: null,
    tab: 'debts',
    navTarget: '[data-tab="debts"]',
    icon: '📝',
    title: 'Madeni Tab — Track Debts',
    body: 'When a customer takes goods on credit, record it here immediately. Enter their name and amount. Tap Pay when they clear the debt.',
    tip: '💡 Always record madeni on the spot — never trust your memory.',
  },
  {
    target: null,
    tab: 'expenses',
    navTarget: '[data-tab="expenses"]',
    icon: '🧾',
    title: 'Expenses Tab',
    body: 'Record every business expense here — transport, airtime, buying stock, anything spent for the business. This helps you see your real profit.',
    tip: '💡 Even KSh 50 airtime counts. Small expenses add up to big losses.',
  },
  {
    target: 'rentCalcSection',
    tab: 'settings',
    navTarget: '[data-tab="settings"]',
    icon: '🏠',
    title: 'Rent Calculator — In Settings',
    body: 'Enter your monthly rent here. BizCount divides it by days remaining and tells you exactly how much to save today.',
    tip: '💡 KSh 8,000 rent ÷ 24 days = KSh 333 to save today.',
  },
  {
    target: null,
    tab: 'settings',
    icon: '🚀',
    title: "You're Ready to Go!",
    body: "That's everything! Start by adding your first product, then record every sale. The more you track, the more your business grows.",
    tip: '💡 You can replay this tour anytime from Settings → Help.',
  },
];

let tourStep = 0;

function startOnboarding() {
  tourStep = 0;
  _showTourStep();
}

function _showTourStep() {
  const step = TOUR_STEPS[tourStep];
  if (!step) { skipTour(); return; }

  // Navigate to correct tab first
  if (step.navTarget) {
    const navBtn = document.querySelector(step.navTarget);
    if (navBtn) navBtn.click();
  } else if (step.tab) {
    openTab(step.tab);
  }

  // Wait for tab render then show tooltip + spotlight
  setTimeout(() => {
    _renderTourUI(step);
  }, 250);
}

function _renderTourUI(step) {
  const overlay = document.getElementById('tourOverlay');
  const tooltip = document.getElementById('tourTooltip');
  if (!overlay || !tooltip) return;

  overlay.classList.remove('hidden');
  tooltip.classList.remove('hidden');

  // Fill content
  document.getElementById('tourIcon').textContent  = step.icon;
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourBody').textContent  = step.body;
  document.getElementById('tourTip').textContent   = step.tip;

  // Progress dots
  document.getElementById('tourDots').innerHTML = TOUR_STEPS.map((_, i) => `
    <div style="
      width:${i === tourStep ? '22px' : '7px'};height:7px;
      border-radius:4px;transition:all 0.25s;
      background:${i === tourStep ? '#1A7A4A' : '#E2E8F0'};
    "></div>`).join('');

  // Last step
  const isLast = tourStep === TOUR_STEPS.length - 1;
  document.getElementById('tourNextBtn').textContent = isLast ? '🚀 Start Now!' : 'Next →';

  // Spotlight + tooltip position
  const target = step.target ? document.getElementById(step.target) : null;

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => _positionTour(target), 350);
  } else {
    _clearSpotlight();
    _placeTooltipCenter();
  }
}

function _positionTour(target) {
  const rect  = target.getBoundingClientRect();
  const pad   = 8;
  const viewH = window.innerHeight;

  // Spotlight cutout
  const cutout = document.getElementById('spotCutout');
  const border = document.getElementById('spotBorder');
  if (cutout && border) {
    const attrs = { x: rect.left - pad, y: rect.top - pad, width: rect.width + pad*2, height: rect.height + pad*2, rx: 12 };
    Object.entries(attrs).forEach(([k,v]) => { cutout.setAttribute(k,v); border.setAttribute(k,v); });
  }

  // Tooltip: above or below target
  const tooltip  = document.getElementById('tourTooltip');
  const arrow    = document.getElementById('tourArrow');
  const spaceBelow = viewH - rect.bottom;
  const spaceAbove = rect.top;

  if (spaceBelow >= 220 || spaceBelow > spaceAbove) {
    tooltip.style.top    = (rect.bottom + pad + 10) + 'px';
    tooltip.style.bottom = 'auto';
    if (arrow) { arrow.style.top='-9px'; arrow.style.bottom='auto'; arrow.style.borderTop='none'; arrow.style.borderBottom='9px solid white'; arrow.style.display='block'; }
  } else {
    tooltip.style.bottom = (viewH - rect.top + pad + 10) + 'px';
    tooltip.style.top    = 'auto';
    if (arrow) { arrow.style.bottom='-9px'; arrow.style.top='auto'; arrow.style.borderBottom='none'; arrow.style.borderTop='9px solid white'; arrow.style.display='block'; }
  }
}

function _clearSpotlight() {
  ['spotCutout','spotBorder'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.setAttribute('width','0'); el.setAttribute('height','0'); }
  });
  const arrow = document.getElementById('tourArrow');
  if (arrow) arrow.style.display = 'none';
}

function _placeTooltipCenter() {
  const tooltip = document.getElementById('tourTooltip');
  if (!tooltip) return;
  tooltip.style.bottom = '48px';
  tooltip.style.top    = 'auto';
}

function nextTourStep() {
  tourStep++;
  if (tourStep >= TOUR_STEPS.length) { skipTour(); return; }
  _showTourStep();
}

function skipTour() {
  ['tourOverlay','tourTooltip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  _clearSpotlight();
  DB.set('onboarding_done', true);
  showToast('🎉 Tour done! Start by adding your first product.', 'success');
  openTab('products');
  setTimeout(() => openAddProduct(), 500);
}

function checkOnboarding() {
  if (!DB.get('onboarding_done', false)) {
    setTimeout(() => startOnboarding(), 1000);
  }
}

// ============================================================
// HISTORY MODULE — review any past date
// ============================================================

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getLast(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function loadHistoryDate(dateStr) {
  if (!dateStr) return;

  // Set picker value
  const picker = document.getElementById('historyDatePicker');
  if (picker) picker.value = dateStr;

  const sales    = Data.getSales().filter(s => s.date === dateStr);
  const expenses = Data.getExpenses().filter(e => e.date === dateStr);

  const revenue  = sales.reduce((s, r) => s + r.revenue, 0);
  const cogs     = sales.reduce((s, r) => s + (r.buyPrice * r.qty), 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const net      = revenue - cogs - expTotal;

  // Show result area
  document.getElementById('historyResult').style.display = 'block';
  document.getElementById('historyEmpty').style.display  = 'none';

  // Date label
  const d = new Date(dateStr + 'T00:00:00');
  _setEl('historyDateLabel', d.toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));

  // Hero
  const hero = document.getElementById('historyHero');
  if (hero) hero.style.background = net >= 0
    ? 'linear-gradient(135deg, var(--green) 0%, #0F5230 100%)'
    : 'linear-gradient(135deg, #C0392B 0%, #922B21 100%)';
  _setEl('historyProfit',    fmt(net));
  _setEl('historyProfitSub', net >= 0 ? 'Good day! 🎉' : 'Loss day — review expenses');

  // Breakdown
  _setEl('historyRevenue',  fmt(revenue));
  _setEl('historyCOGS',    `-${fmt(cogs)}`);
  _setEl('historyExpenses',`-${fmt(expTotal)}`);
  _setEl('historyNet',      fmt(net));

  // Net colour
  const netEl = document.getElementById('historyNet');
  if (netEl) netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';

  // Sales list
  const salesList = document.getElementById('historySalesList');
  if (salesList) {
    if (!sales.length) {
      salesList.innerHTML = `<div class="empty-state" style="padding:12px 0"><div class="e-icon">🛒</div><div class="e-text">No sales on this date</div></div>`;
    } else {
      salesList.innerHTML = sales.map(s => `
        <div class="tx-item">
          <div class="tx-dot sale">💰</div>
          <div class="tx-info">
            <div class="tx-name">${s.productName} × ${s.qty}</div>
            <div class="tx-time">${s.paymentMethod === 'mpesa' ? '📱 M-Pesa' : '💵 Cash'}</div>
          </div>
          <div class="tx-amount plus">+${fmt(s.profit)}</div>
        </div>`).join('');
    }
  }

  // Expenses list
  const expList = document.getElementById('historyExpensesList');
  if (expList) {
    if (!expenses.length) {
      expList.innerHTML = `<div class="empty-state" style="padding:12px 0"><div class="e-icon">📋</div><div class="e-text">No expenses on this date</div></div>`;
    } else {
      expList.innerHTML = expenses.map(e => `
        <div class="tx-item">
          <div class="tx-dot expense">🧾</div>
          <div class="tx-info">
            <div class="tx-name">${e.description}</div>
            <div class="tx-time">${e.category}</div>
          </div>
          <div class="tx-amount minus">-${fmt(e.amount)}</div>
        </div>`).join('');
    }
  }
}

// ============================================================
// STAFF MODULE
// ============================================================

const Staff = {
  getAccount: () => DB.get('staff_account', null),
  saveAccount: (acc) => DB.set('staff_account', acc),
  isStaffMode: () => DB.get('staff_mode', false),
  setStaffMode: (v) => DB.set('staff_mode', v),
};

function openStaffSetup() {
  const acc = Staff.getAccount();
  if (acc) {
    document.getElementById('staffName').value    = acc.name || '';
    document.getElementById('staffPinNew').value  = '';
    document.getElementById('staffPinNew2').value = '';
  }
  openModal('staffSetupModal');
}

function saveStaffAccount() {
  const name = document.getElementById('staffName').value.trim();
  const pin  = document.getElementById('staffPinNew').value.trim();
  const pin2 = document.getElementById('staffPinNew2').value.trim();
  if (!name) { showToast('Enter staff name.', 'error'); return; }
  if (!pin || pin.length < 4) { showToast('PIN must be 4 digits.', 'error'); return; }
  if (pin !== pin2) { showToast('PINs do not match.', 'error'); return; }
  Staff.saveAccount({ name, pin });
  if (window.Firebase) window.Firebase.cloud.saveSettings({ ...Data.getSettings(), staffAccount: { name, pin } });
  closeModal('staffSetupModal');
  renderSettings();
  showToast(`✅ Staff account for ${name} created!`, 'success');
}

function handleStaffLogin() {
  const pin = document.getElementById('staffPinInput').value.trim();
  const acc = Staff.getAccount();
  if (!acc) { showToast('No staff account set up yet.', 'error'); return; }
  if (pin !== acc.pin) { showToast('Wrong PIN. Try again.', 'error'); return; }
  Staff.setStaffMode(true);
  Pages.show('staffAppPage');
  _setEl('staffNameBadge', acc.name);
  // Set shop name on staff login page
  const settings = Data.getSettings();
  _setEl('staffShopName', settings.businessName || 'My Shop');
  renderStaffRecent();
  showToast(`Welcome, ${acc.name}! 👷`, 'success');
}

function staffLogout() {
  Staff.setStaffMode(false);
  Pages.show('loginPage');
  document.getElementById('staffPinInput').value = '';
}

function renderStaffRecent() {
  const list  = document.getElementById('staffRecentSales');
  if (!list) return;
  const sales = Sales.recent(8);
  if (!sales.length) {
    list.innerHTML = `<div class="empty-state"><div class="e-icon">🛒</div><div class="e-text">No sales yet today</div></div>`;
    return;
  }
  // Staff sees product names and qty but NOT profit amounts
  list.innerHTML = sales.map(s => `
    <div class="tx-item">
      <div class="tx-dot sale">💰</div>
      <div class="tx-info">
        <div class="tx-name">${s.productName} × ${s.qty}</div>
        <div class="tx-time">${Dates.timeAgo(s.createdAt)} · ${s.paymentMethod === 'mpesa' ? '📱 M-Pesa' : '💵 Cash'}</div>
      </div>
      <div style="font-size:0.75rem;font-weight:700;color:var(--muted)">Recorded ✅</div>
    </div>`).join('');
}

// On staff login page load, show shop name
function initStaffLoginPage() {
  const settings = Data.getSettings();
  _setEl('staffShopName', settings.businessName || 'My Shop');
}

// ============================================================
// SMS REPORT — Africa's Talking API
// ============================================================

// ===== AFRICA'S TALKING API CONFIG =====
// Sign up free at https://africastalking.com
// Use 'sandbox' username + sandbox API key for testing
// Switch to production when ready

const SMS = {
  getSettings: () => DB.get('sms_settings', { phone1: '', phone2: '', time: '22:30', apiKey: '', username: 'sandbox', enabled: false }),
  saveSettings: (s) => DB.set('sms_settings', s),
};

function openSmsSettings() {
  const s = SMS.getSettings();
  const p1 = document.getElementById('smsPhone1');
  const p2 = document.getElementById('smsPhone2');
  const t  = document.getElementById('smsTime');
  const k  = document.getElementById('atApiKey');
  const u  = document.getElementById('atUsername');
  if (p1) p1.value = s.phone1 ? s.phone1.replace('254','') : '';
  if (p2) p2.value = s.phone2 ? s.phone2.replace('254','') : '';
  if (t)  t.value  = s.time || '22:30';
  if (k)  k.value  = s.apiKey || '';
  if (u)  u.value  = s.username || 'sandbox';
  openModal('smsSettingsModal');
}

function saveSmsSettings() {
  const raw1 = document.getElementById('smsPhone1')?.value.replace(/\D/g,'') || '';
  const raw2 = document.getElementById('smsPhone2')?.value.replace(/\D/g,'') || '';
  const norm = (p) => p ? (p.startsWith('0') ? '254'+p.slice(1) : p.startsWith('7')||p.startsWith('1') ? '254'+p : p) : '';
  const s = {
    phone1:   norm(raw1),
    phone2:   norm(raw2),
    time:     document.getElementById('smsTime')?.value || '22:30',
    apiKey:   document.getElementById('atApiKey')?.value.trim() || '',
    username: document.getElementById('atUsername')?.value.trim() || 'sandbox',
    enabled:  true,
  };
  SMS.saveSettings(s);
  closeModal('smsSettingsModal');
  renderSettings();
  scheduleDailySms();
  showToast('✅ SMS settings saved!', 'success');
}

// Build the SMS message text
function buildSmsMessage() {
  const settings  = Data.getSettings();
  const revenue   = Sales.todayRevenue();
  const cogs      = Sales.todayCOGS();
  const net       = revenue - cogs;
  const expenses  = Expenses.todayTotal();
  const debt      = Debts.totalOwed();
  const today     = Dates.today();
  const d         = new Date();
  const dateStr   = d.toLocaleDateString('en-KE', { day:'numeric', month:'short' });
  return `BizCount Report ${dateStr}
Shop: ${settings.businessName || 'My Shop'}
Revenue: KSh ${revenue.toLocaleString()}
Stock Cost: KSh ${cogs.toLocaleString()}
Net Profit: KSh ${net.toLocaleString()}
Expenses: KSh ${expenses.toLocaleString()}
Madeni Owed: KSh ${debt.toLocaleString()}
---
${net >= 0 ? 'Good day! Keep it up!' : 'Check your expenses tomorrow.'}`;
}

// Send SMS via Africa's Talking API
// ===== AFRICA'S TALKING: Must be called from backend in production =====
// Frontend call is fine for sandbox/testing
async function sendSmsViaAT(message, phones) {
  const s = SMS.getSettings();
  if (!s.apiKey || !s.username) {
    console.warn('[SMS] No AT API key configured');
    return false;
  }

  // ===== AFRICA'S TALKING API CALL =====
  // In production: POST to your backend /api/sms/send which calls AT
  // Direct browser call works for sandbox testing
  try {
    const body = new URLSearchParams({
      username: s.username,
      to: phones.filter(Boolean).join(','),
      message,
      from: 'BizCount', // alphanumeric sender (requires AT approval in production)
    });
    const res = await fetch('https://api.sandbox.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': s.apiKey,
        'Accept': 'application/json',
      },
      body,
    });
    const data = await res.json();
    console.log('[SMS] AT response:', data);
    return true;
  } catch (e) {
    console.error('[SMS] Error:', e);
    return false;
  }
}

async function sendTestSms() {
  const s = SMS.getSettings();
  const phones = [s.phone1 ? `+${s.phone1}` : null, s.phone2 ? `+${s.phone2}` : null].filter(Boolean);
  if (!phones.length) { showToast('Add at least one phone number.', 'error'); return; }
  showToast('📨 Sending test SMS...', 'info');
  const msg = buildSmsMessage();
  const ok  = await sendSmsViaAT(msg, phones);
  showToast(ok ? '✅ Test SMS sent!' : '❌ SMS failed. Check your API key.', ok ? 'success' : 'error');
}

// Schedule daily SMS using setTimeout (works while app is open)
// For background SMS (app closed), use a Firebase Cloud Function (see README)
let _smsTimer = null;
function scheduleDailySms() {
  if (_smsTimer) clearTimeout(_smsTimer);
  const s = SMS.getSettings();
  if (!s.enabled || !s.phone1) return;

  const [h, m]  = (s.time || '22:30').split(':').map(Number);
  const now      = new Date();
  const target   = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // next day if already passed

  const delay = target - now;
  _smsTimer = setTimeout(async () => {
    const msg    = buildSmsMessage();
    const phones = [s.phone1 ? `+${s.phone1}` : null, s.phone2 ? `+${s.phone2}` : null].filter(Boolean);
    await sendSmsViaAT(msg, phones);
    scheduleDailySms(); // reschedule for next day
  }, delay);

  console.log(`[SMS] Scheduled for ${target.toLocaleTimeString('en-KE')}`);
}

// ============================================================
// APP INIT
// ============================================================

function initApp() {
  Pages.show('appPage');
  const settings = Data.getSettings();
  const topBarName = document.getElementById('topBarName');
  if (topBarName) topBarName.textContent = settings.businessName || 'My Shop';
  loadSampleData();
  Trial.init();
  Trial.renderBanner();
  openTab('home');
  scheduleDailySms();
  initStaffLoginPage();
  checkOnboarding();
}

// ============================================================
// DOCUMENT READY
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  Pages.show('loginPage');

  const waitForFirebase = setInterval(() => {
    if (window.Firebase) {
      clearInterval(waitForFirebase);
      window.Firebase.initAuth();
    }
  }, 50);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  const paywallOverlay = document.getElementById('paywallModal');
  if (paywallOverlay) {
    paywallOverlay.addEventListener('click', (e) => {
      if (e.target === paywallOverlay) paywallOverlay.classList.remove('open');
    });
  }
});
