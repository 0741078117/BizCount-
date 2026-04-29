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

  monthSaved: () => DailySavings.monthRentSaved(),

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
  const settings      = Data.getSettings();

  // ── Revenue & costs ──────────────────────────────────────
  const todayRevenue  = Sales.todayRevenue();            // Total money collected
  const todayCOGS     = Sales.todayCOGS();               // Cost of goods sold (buying prices)
  const todayGrossProfit = todayRevenue - todayCOGS;     // Gross profit (sell − buy)
  const todayExpenses = Expenses.todayTotal();           // Other expenses (transport, etc.)
  const todayNetProfit= todayGrossProfit - todayExpenses;// Profit after all expenses

  // ── Savings deducted from today's profit ─────────────────
  const dailyRentSave    = RentTracker.dailySavingsNeeded();
  const dailyRestockSave = parseFloat(settings.restockFund) || 0;
  const totalDailySavings= dailyRentSave + dailyRestockSave;

  // Money you can actually use = net profit minus what you must set aside
  const moneyYouCanUse   = todayNetProfit - totalDailySavings;

  // ── Month totals ─────────────────────────────────────────
  const monthProfit   = Sales.monthTotal();
  const monthRevenue  = Sales.monthRevenue();
  const totalDebt     = Debts.totalOwed();
  const rentProgress  = RentTracker.rentProgress();
  const rent          = parseFloat(settings.rent) || 0;
  const monthSaved    = RentTracker.monthSaved();

  // ── Hero card ─────────────────────────────────────────────
  const heroNum  = document.getElementById('heroProfitNum');
  const heroSub  = document.getElementById('heroSub');
  const heroDate = document.getElementById('heroDate');
  if (heroNum)  heroNum.textContent  = fmt(todayNetProfit);
  if (heroSub)  heroSub.textContent  = todayNetProfit >= 0 ? 'Profit after all expenses' : 'You spent more than you earned';
  if (heroDate) {
    heroDate.textContent = new Date().toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long' });
  }
  const hero = document.getElementById('heroCard');
  if (hero) {
    hero.style.background = todayNetProfit >= 0
      ? 'linear-gradient(135deg, var(--green) 0%, #0F5230 100%)'
      : 'linear-gradient(135deg, #C0392B 0%, #922B21 100%)';
  }

  // ── Money Breakdown card ──────────────────────────────────
  _setEl('bdRevenue',      fmt(todayRevenue));
  _setEl('bdCOGS',        `-${fmt(todayCOGS)}`);
  _setEl('bdGrossProfit',  fmt(todayGrossProfit));
  _setEl('bdExpenses',    `-${fmt(todayExpenses)}`);
  _setEl('bdNetProfit',    fmt(todayNetProfit));
  _setEl('bdRentSave',    `-${fmt(dailyRentSave)}`);
  _setEl('bdRestockSave', `-${fmt(dailyRestockSave)}`);
  _setEl('bdCanUse',       fmt(moneyYouCanUse));

  // Colour the "can use" number
  const canUseEl = document.getElementById('bdCanUse');
  if (canUseEl) canUseEl.style.color = moneyYouCanUse >= 0 ? 'var(--green)' : 'var(--red)';

  // ── Stat cards ───────────────────────────────────────────
  _setEl('statRevenue',    fmt(todayRevenue));
  _setEl('statExpenses',   fmt(todayExpenses));
  _setEl('statDebt',       fmt(totalDebt));
  _setEl('statMonthProfit',fmt(monthProfit));

  // ── Do Not Touch box ─────────────────────────────────────
  _setEl('doNotSpendAmt', fmt(Math.max(0, totalDailySavings)));
  _setEl('doNotSpendBreakdown',
    `Rent KSh ${dailyRentSave.toLocaleString()} + Restock KSh ${dailyRestockSave.toLocaleString()}`);

  // ── Daily savings box ────────────────────────────────────
  _setEl('dailySaveAmt',     fmt(dailyRentSave));
  _setEl('dailyRestockAmt',  fmt(dailyRestockSave));
  _setEl('dailySaveSub',
    `${Dates.daysInMonth() - Dates.dayOfMonth() + 1} days remaining this month`);

  // ── Rent progress bar ────────────────────────────────────
  _setEl('rentProgressLabel', `${fmt(monthSaved)} / ${fmt(rent)}`);
  _setEl('rentProgressPct', `${rentProgress}%`);
  const fill = document.getElementById('rentProgressFill');
  if (fill) {
    fill.style.width = `${rentProgress}%`;
    fill.className = `progress-fill ${rentProgress < 50 ? 'danger' : rentProgress < 80 ? 'gold' : ''}`;
  }

  // ── Cash flow split (month) ───────────────────────────────
  const monthRestockSaved = DailySavings.monthRestockSaved();
  const businessMoney = Math.max(0, monthProfit - Expenses.monthTotal()
    - Withdrawals.monthTotal() - RentTracker.monthSaved() - monthRestockSaved);
  const personalMoney = Withdrawals.monthTotal();
  _setEl('cfBusiness', fmt(businessMoney));
  _setEl('cfPersonal',  fmt(personalMoney));
  _setEl('cfRentSaved', fmt(RentTracker.monthSaved()));
  _setEl('cfRestockSaved', fmt(monthRestockSaved));

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
  settings.dailyRentSaving= dailyManual;  // 0 = auto-calculate from rent ÷ days
  settings.restockFund    = restock;
  Data.saveSettings(settings);

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
