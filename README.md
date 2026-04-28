# BizCount 💰
### Smart Business Tracker for Small Kenyan Businesses

> Fuata pesa yako. Track your profit. Grow your business. 🇰🇪

---

## 🎯 Who is this for?

BizCount is built for:
- **Mama Mboga** vendors
- **Kiosk** owners
- **Mitumba** sellers
- **Small retail shops**
- Any informal business owner who wants to control their money

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📦 **Products** | Add products with buy price, sell price, stock quantity |
| 💰 **Daily Profit** | See "Today's Net Profit" at a glance |
| ⚠️ **Low Stock Alerts** | Get warned when products are running low |
| 🔥 **Fast-Moving Products** | See which items sell the most |
| 📝 **Madeni Tracker** | Record who owes you money and how much |
| 🏠 **Rent Tracker** | Set monthly rent, see daily savings target |
| 🚫 **Do Not Spend** | Clearly shows money reserved for rent |
| 💼 **Cash Flow** | Separate Business Money vs Personal Use |
| 📱 **M-Pesa Ready** | Daraja API integration for KSh 200/month subscription |
| 🔒 **Trial System** | 3-day free trial, then KSh 200/month |

---

## 🚀 How to Run Locally

### Option 1: Open directly in browser
```bash
# Just open the HTML file
open index.html
# or on Windows:
start index.html
```

### Option 2: Use a local server (recommended)
```bash
# Using Python
python3 -m http.server 8080

# Using Node.js (if npx available)
npx serve .

# Then open: http://localhost:8080
```

---

## 📁 Project Structure

```
bizcount/
├── index.html          ← Main app (Login, Register, Dashboard, all screens)
├── css/
│   └── style.css       ← All styles (mobile-first, KE-themed)
├── js/
│   └── app.js          ← All logic (localStorage, sales, debts, etc.)
├── assets/             ← (Place logo/images here)
└── README.md           ← This file
```

---

## 🔥 Firebase Integration

Look for these comments in `js/app.js`:

```javascript
// ===== FIREBASE: =====
```

Steps to add Firebase:
1. Create project at https://console.firebase.google.com
2. Enable **Authentication** (Phone Auth)
3. Enable **Firestore Database**
4. Replace `localStorage` calls with Firestore:
   ```javascript
   // Instead of:
   DB.set('products', data)
   // Use:
   firebase.firestore().collection('products').add(data)
   ```
5. Add Firebase SDK to `index.html`:
   ```html
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js"></script>
   <script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore.js"></script>
   ```

---

## 📱 Daraja API (M-Pesa) Integration

Look for this comment in `js/app.js`:

```javascript
// ===== DARAJA API CONFIG =====
```

Steps to activate M-Pesa payments:
1. Register at https://developer.safaricom.co.ke
2. Create an app and get:
   - `CONSUMER_KEY`
   - `CONSUMER_SECRET`
   - `PASSKEY`
   - `SHORTCODE`
3. Update `DARAJA` config object in `app.js`
4. **IMPORTANT**: Move auth logic to your backend:
   ```
   Frontend → POST /api/mpesa/stk-push → Your Node.js/Firebase Function → Daraja API
   ```
5. Never expose credentials in frontend JavaScript!

### Node.js Backend Example:
```javascript
// server.js (Express)
app.post('/api/mpesa/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
  // Get access token
  const token = await getAccessToken(CONSUMER_KEY, CONSUMER_SECRET);
  // Initiate STK Push
  const result = await stkPush(token, phone, amount, SHORTCODE, PASSKEY);
  res.json(result);
});
```

---

## 📋 Demo Data

On first load, BizCount automatically adds:
- 5 sample products (Unga, Sukari, Mafuta, Bread, Maziwa)
- 2 sample sales
- 1 sample debt (Mary Wanjiku)
- Monthly rent set to KSh 8,000

This helps you see how the app looks with real data.

---

## 💡 Tips for Business Owners

1. **Record every sale** — even KSh 10 sales add up!
2. **Set your rent amount** — BizCount will tell you how much to save daily
3. **Never mix business and personal money** — use the withdrawal feature to track personal use
4. **Check "Do Not Spend"** — that money is for rent!
5. **Record madeni immediately** — don't trust your memory

---

## 🛡️ Data & Privacy

- All data is stored on **your phone** (localStorage)
- No data is sent anywhere without your permission
- After Firebase integration, data syncs to your private cloud account

---

## 📞 Support

Made with ❤️ for Kenyan small businesses.

For support or custom development:
- Email: support@bizcount.ke (placeholder)
- WhatsApp: +254 700 000 000 (placeholder)

---

*BizCount v1.0 — Kazi nzuri! 🌟*
