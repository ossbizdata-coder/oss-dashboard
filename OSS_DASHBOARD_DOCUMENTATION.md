# OSS Dashboard — Documentation

**Technology:** React 18 · Vite · Tailwind CSS · Axios · React Router v6  
**URL:** `http://74.208.132.78` (HTTP) → `https://www.onestopdaily.shop` (when SSL ready)  
**Location:** `C:\dev\oss\oss-dashboard`  
**Access:** ADMIN and SUPERADMIN roles only

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Authentication & Access Control](#4-authentication--access-control)
5. [Pages & Features](#5-pages--features)
6. [API Integration](#6-api-integration)
7. [Build & Deployment](#7-build--deployment)
8. [Configuration (.env)](#8-configuration-env)

---

## 1. Overview

The OSS Dashboard is a **web-based admin panel** providing a comprehensive view of the OneStopSolutions business. It connects to the shared Spring Boot backend and is restricted to **ADMIN and SUPERADMIN users only**.

**Key capabilities:**
- Real-time overview of all 3 shops (Cafe, Bookshop, Food Hut)
- Daily cash tracking — expenses, sales, credits per shop
- Staff management — attendance, salary, credits
- Food Hut POS reporting
- Financial reports (monthly, ranges)
- Audit log viewer
- User management (SUPERADMIN)

---

## 2. Tech Stack

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| React Router v6 | Client-side routing |
| Axios | HTTP client (with JWT interceptor) |
| Tailwind CSS | Utility-first styling |
| Lucide React | Icon library |

---

## 3. Project Structure

```
oss-dashboard/
├── src/
│   ├── App.jsx                  # Root router, PrivateRoute guard
│   ├── main.jsx                 # Entry point
│   ├── index.css                # Tailwind base styles
│   ├── contexts/
│   │   └── AuthContext.jsx      # Auth state, login/logout, role checks
│   ├── services/
│   │   └── api.js               # All API calls (Axios instance + endpoint functions)
│   ├── pages/
│   │   ├── LoginPage.jsx        # Login screen
│   │   ├── DashboardPage.jsx    # Home — shop summaries, KPIs
│   │   ├── ShopsPage.jsx        # All shops overview
│   │   ├── ShopDetailPage.jsx   # Single shop daily view
│   │   ├── StaffPage.jsx        # Staff attendance & performance
│   │   ├── CreditsPage.jsx      # Credits management
│   │   ├── ExpensesPage.jsx     # Expenses view
│   │   ├── FoodHutPage.jsx      # Food Hut sales
│   │   ├── ReportsPage.jsx      # Attendance & salary reports
│   │   ├── MonthlyPage.jsx      # Monthly financial overview
│   │   ├── AuditLogsPage.jsx    # Audit log viewer (ADMIN+)
│   │   ├── SettingsPage.jsx     # App settings
│   │   └── UsersPage.jsx        # User management (SUPERADMIN)
│   ├── components/
│   │   └── Layout.jsx           # Sidebar + nav wrapper
│   └── utils/                   # Helper utilities
├── nginx/                       # Nginx config for server deployment
├── server/                      # Setup & deploy scripts
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env                         # VITE_API_URL (required)
```

---

## 4. Authentication & Access Control

### Login Flow

1. User enters email + password on `/login`
2. Calls `POST /api/auth/login` → receives JWT token + role
3. **Frontend role check:** If role is not `ADMIN` or `SUPERADMIN`, `localStorage` is cleared and access is denied
4. On success, user data is stored in `localStorage` and redirected to dashboard

### Route Protection — `PrivateRoute`

```jsx
function PrivateRoute({ children }) {
  const { isLoggedIn, hasAccess } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" />
  if (!hasAccess) return <AccessDeniedScreen />
  return children
}
```

All routes under `/` are wrapped in `PrivateRoute`. If:
- Not logged in → redirected to `/login`
- Logged in but role is STAFF/CUSTOMER → shows Access Denied screen with logout button

### AuthContext

Located at `src/contexts/AuthContext.jsx`. Provides:

| Value | Type | Description |
|-------|------|-------------|
| `user` | Object | `{ name, email, role }` |
| `isLoggedIn` | Boolean | Token present in localStorage |
| `loading` | Boolean | Auth state being resolved |
| `isSuperAdmin` | Boolean | `role === 'SUPERADMIN'` |
| `isAdmin` | Boolean | `role === 'ADMIN' \|\| isSuperAdmin` |
| `hasAccess` | Boolean | `isAdmin` — gating dashboard access |
| `login(email, pass)` | Function | Calls API, stores session |
| `logout()` | Function | Clears localStorage, resets state |

### Session Storage

All session data is in `localStorage`:
```
token     JWT Bearer token
email     User email
name      User display name
role      ADMIN | SUPERADMIN
userId    Numeric user ID
```

> **Auto-logout:** The Axios interceptor automatically logs out and redirects to `/login` on any `401 Unauthorized` response.

---

## 5. Pages & Features

### `/` — Dashboard
- Shows KPI cards: total daily sales, total expenses, unpaid credits
- Shop-by-shop status tiles (Cafe, Bookshop, Food Hut)
- Quick navigation to each shop's detail view

### `/shops` — Shops Overview
- List of all shops with latest closing balance
- Date picker to view any past day
- Navigate to individual shop detail

### `/shops/:shopCode` — Shop Detail
- Full daily cash breakdown for selected shop and date
- Opening cash, closing cash, net profit
- Expense list with categories
- Manual sales list
- Credits for the day
- **SUPERADMIN:** Override opening/closing cash, edit/delete individual transactions

### `/staff` — Staff Management
- Attendance overview (today's check-ins)
- Staff list with working status
- ADMIN+: Edit overtime and deduction adjustments

### `/credits` — Credits Management
- Full credits list across all shops
- Filter by: shop, paid/unpaid status
- Total, paid, unpaid summaries
- ADMIN+: Add credits
- SUPERADMIN: Mark as paid, edit, delete

### `/expenses` — Expenses View
- Expenses filtered by shop and date
- Category breakdown

### `/foodhut` — Food Hut POS
- View Food Hut menu items
- Daily sales records
- Sales summary for selected date

### `/reports` — Reports
- Attendance report by date range / user
- Salary report by month

### `/monthly` — Monthly Overview
- Month selector
- Aggregate totals per shop (sales, expenses, profit)
- Comparison across shops

### `/audit-logs` — Audit Log Viewer *(ADMIN+)*
- Full log of all create/update/delete operations
- Filter by date, entity type (DAILY_CASH, CREDIT, TRANSACTION), action
- Shows: who did it, what changed, timestamp

### `/users` — User Management *(SUPERADMIN only)*
- List all users with roles
- Edit user details (name, role, hourly rate)
- Delete user

### `/settings` — Settings
- Display preferences

---

## 6. API Integration

All API calls go through a single Axios instance in `src/services/api.js`.

### Base URL
```javascript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
```

### Interceptors

**Request:** Automatically attaches `Authorization: Bearer <token>` from localStorage.

**Response:** Any `401` response triggers auto-logout and redirect to `/login`.

### API Module Reference

| Export | Endpoints Covered |
|--------|------------------|
| `authApi` | Login, get all users |
| `dailyCashApi` | Daily summary, monthly summary, override |
| `transactionApi` | Get by date, create, update, delete |
| `creditApi` | CRUD, outstanding total, by-shop filter |
| `attendanceApi` | Today, all |
| `salaryApi` | Get all, monthly admin view |
| `foodhutApi` | Items, daily sales, record sale |
| `reportApi` | Attendance & salary reports |
| `auditApi` | All logs, by-date, by-user, by-entity, filter |
| `expenseTypeApi` | List, create, delete |
| `adminTransactionApi` | Edit/delete (SUPERADMIN) |
| `userApi` | List, update, delete users |

---

## 7. Build & Deployment

### Local Development

```bash
cd C:\dev\oss\oss-dashboard
npm install
npm run dev          # Starts on http://localhost:5173
```

Create `.env.local`:
```
VITE_API_URL=http://74.208.132.78
```

### Production Build

```bash
npm run build        # Outputs to /dist folder
```

### Deploy to Server

```bash
# From Git Bash or PowerShell (with pscp):
scp -r dist/* root@74.208.132.78:/var/www/oss-dashboard/

# Set permissions and reload Nginx
ssh root@74.208.132.78 "chown -R www-data:www-data /var/www/oss-dashboard && nginx -t && systemctl reload nginx"
```

Or use the deploy script:
```bash
bash server/deploy-dashboard.sh
```

### Nginx Configuration

Nginx serves the built React SPA and proxies `/api/**` to the Spring Boot backend on port 8080:

```nginx
server {
    listen 80;
    server_name 74.208.132.78 www.onestopdaily.shop;

    root /var/www/oss-dashboard;
    index index.html;

    # React SPA — all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to Spring Boot
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 8. Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |

**For production (HTTP):**
```
VITE_API_URL=http://74.208.132.78
```

**For production (HTTPS — when SSL is ready):**
```
VITE_API_URL=https://www.onestopdaily.shop
```

> After changing `.env`, run `npm run build` and redeploy the `/dist` folder.

