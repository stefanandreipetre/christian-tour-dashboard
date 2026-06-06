# Christian Tour — Sales Dashboard

Web-based sales reporting dashboard that pulls live data from SharePoint Excel files (B2B + B2C), refreshes hourly, and supports period comparisons, actuals vs plan, and actuals vs last year.

---

## Architecture

```
christian-tour-dashboard/
├── backend/          # Python FastAPI — data fetching + API
│   ├── main.py
│   ├── sharepoint_client.py
│   ├── data_processor.py
│   ├── cache.py
│   └── requirements.txt
├── frontend/         # React + Vite + Recharts — dashboard UI
│   └── src/
│       ├── App.jsx
│       └── components/
├── render.yaml       # One-click Render deployment
└── README.md
```

---

## Quick Start — Local Dev

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy .env.example and fill in your credentials
cp .env.example .env
# Edit .env → set SHAREPOINT_USERNAME, SHAREPOINT_PASSWORD, FILE_*_PATH

uvicorn main:app --reload --port 8000
```

API docs available at http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "VITE_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Open http://localhost:3000

---

## Deploy to Render (GitHub → Render)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/christian-tour-dashboard.git
git push -u origin main
```

### Step 2 — Create services on Render

1. Go to https://dashboard.render.com → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render will detect `render.yaml` and create both services automatically

### Step 3 — Set secret environment variables

In Render dashboard → **ct-dashboard-api** → **Environment**:

| Key | Value |
|-----|-------|
| `SHAREPOINT_USERNAME` | `stefan.petre@christiantour.ro` |
| `SHAREPOINT_PASSWORD` | `your_password` |

> These are marked `sync: false` in render.yaml so they never appear in git.

### Step 4 — Update the frontend API URL

After the backend deploys, copy its URL (e.g. `https://ct-dashboard-api.onrender.com`).

In Render dashboard → **ct-dashboard-ui** → **Environment**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://ct-dashboard-api.onrender.com` |

Trigger a redeploy of the frontend.

---

## Configuring SharePoint File Paths

The paths must be the **server-relative** paths inside your SharePoint personal site. The defaults are set in `render.yaml`. If your files are in a different folder, update:

| Env var | Default |
|---------|---------|
| `FILE_B2B_PATH` | `/personal/stefan_petre_christiantour_ro/Documents/B2B Monthly 2024_2025 - Copy.xlsx` |
| `FILE_B2C_PATH` | `/personal/stefan_petre_christiantour_ro/Documents/Dashboard Performance ( b2c)_2026.xlsx` |
| `FILE_OUTLOOK_PATH` | `/personal/stefan_petre_christiantour_ro/Documents/Outlook _CHR_Sales_2026_Site separat.xlsm` |
| `FILE_TARGET_PATH` | `/personal/stefan_petre_christiantour_ro/Documents/Target B2B 2026_Refacut.xlsx.xlsx` |

> **Tip:** To find the exact path, navigate to the file in SharePoint, click the three dots → Details, and look at the path shown.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Data load status + next refresh time |
| POST | `/api/refresh` | Trigger immediate refresh |
| GET | `/api/overview?year=2025` | Combined KPIs for all sources |
| GET | `/api/b2b/summary?year=2025&month=3` | B2B KPIs |
| GET | `/api/b2b/monthly?year=2025&compare_year=2024` | Monthly chart data |
| GET | `/api/b2b/agencies?year=2025&top=20` | Agency breakdown |
| GET | `/api/b2b/vs-target?year=2025` | Actual vs target monthly |
| GET | `/api/b2c/summary` | B2C KPIs |
| GET | `/api/b2c/monthly` | B2C monthly chart |
| GET | `/api/outlook/monthly` | Outlook/forecast monthly |
| GET | `/api/raw/{source}` | Raw sheet data (debug/config) |

---

## Column Auto-Detection

The backend auto-detects column roles using Romanian + English keyword matching:

- **Month columns**: luna, month, perioada, date, …
- **Year columns**: an, year, …
- **Revenue columns**: vanzari, sales, cifra, valoare, total, ron, eur, …
- **Booking columns**: rezervari, bookings, pax, pasageri, nr., …
- **Plan columns**: plan, target, buget, obiectiv, forecast, …
- **Last year**: ly, an anterior, 2024, precedent, …
- **Agency**: agentie, agency, partener, client, denumire, …

If auto-detection misses columns, check `/api/raw/{source}` to see column names and adjust the keywords in `backend/data_processor.py`.

---

## Refresh Schedule

Data is refreshed **every hour** automatically by APScheduler running inside the FastAPI process. You can also trigger a manual refresh from the dashboard UI (Refresh button) or via `POST /api/refresh`.

> **Note:** Render free-tier services sleep after 15 minutes of inactivity. Use the paid "Starter" plan ($7/month) for always-on hosting with reliable hourly refreshes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, APScheduler |
| SharePoint auth | Office365-REST-Python-Client (username/password) |
| Excel parsing | pandas + openpyxl |
| Frontend | React 18, Vite, Recharts, Tailwind CSS |
| Hosting | Render (Backend: Web Service, Frontend: Static Site) |
| Source control | GitHub |
