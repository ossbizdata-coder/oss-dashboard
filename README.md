# OSS Dashboard — Owner Business Intelligence Web App

A **React + Tailwind CSS** web dashboard for the business owner to monitor and manage all **OneStopSolutions** operations from a laptop browser or mobile.

## 🖥️ Features

### 📊 Dashboard (Home)
- Today's Revenue, Expenses, Net Profit, Unpaid Credits — all in one view
- Live bar chart comparing all 3 shops (Sales / Expenses / Profit)
- Staff attendance live count
- Shop summary cards with direct links

### 🏪 Shops
- All 3 shop summaries on one page (Cafe, Bookshop, Food Hut)
- Per-shop detail page with date navigation
- Full transaction list (sales + expenses) per day
- Opening/closing balance, calculated sales, credits

### 👥 Staff & HR
- Daily attendance overview (who's working / off)
- Salary breakdown table
- Working day counts and overtime

### 💳 Credits
- All customer credit records
- Filter: All / Unpaid / Paid
- **Mark as Paid** directly from the dashboard
- Total unpaid credit amount

### 🍽️ Food Hut
- Daily prepared / sold / remaining tracking
- Date-browser for historical data
- Full menu item list with variations

### 📈 Reports
- Date range selection
- Revenue vs Expenses bar charts
- Profit by shop
- Breakdown table with margin %

### 🔒 Audit Logs *(SUPERADMIN)*
- Full system activity trail
- Search by user, action, entity
- Color-coded action badges

### ⚙️ Settings *(SUPERADMIN)*
- All users list with roles
- Expense type management (add / delete)

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API URL
```bash
cp .env.example .env
# Edit .env and set your backend URL:
# VITE_API_URL=http://your-server-ip:8080
```

### 3. Run Development Server
```bash
npm run dev
# Opens at http://localhost:3000
```

### 4. Build for Production
```bash
npm run build
# Output in dist/ folder — deploy to any web server / Nginx
```

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool |
| React Router 6 | Client-side routing |
| Tailwind CSS 3 | Styling |
| Recharts | Charts & analytics |
| Axios | HTTP client with JWT |
| date-fns | Date formatting |
| lucide-react | Icons |

## 📁 Structure

```
src/
├── main.jsx              # App entry
├── App.jsx               # Routes + Auth wrapper
├── index.css             # Tailwind + custom styles
├── contexts/
│   └── AuthContext.jsx   # JWT auth state
├── services/
│   └── api.js            # All API calls (axios)
├── components/
│   ├── Layout.jsx        # Sidebar + header shell
│   └── ui.jsx            # Shared components (StatCard, Badge, etc.)
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── ShopsPage.jsx
    ├── ShopDetailPage.jsx
    ├── StaffPage.jsx
    ├── CreditsPage.jsx
    ├── FoodHutPage.jsx
    ├── ReportsPage.jsx
    ├── AuditLogsPage.jsx
    └── SettingsPage.jsx
```

## 🔑 Authentication

Uses **JWT tokens** from the same backend as the mobile apps. Login with any `SUPERADMIN` or `ADMIN` account. Tokens stored in `localStorage`.

## 🌐 Deployment (Nginx Example)

```nginx
server {
    listen 80;
    server_name your-dashboard-domain.com;
    root /var/www/oss-dashboard/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
    }
}
```

```bash
# Build and copy
npm run build
sudo cp -r dist/* /var/www/oss-dashboard/
```

