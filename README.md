# Multi-Project Client Portal & Automated KPI Scorecard Engine

> A full-stack, enterprise-grade executive portal that connects to Google Sheets, computes real-time employee compliance KPIs, isolates client data with secure token links, and delivers hierarchical project scorecards with one-click PDF & Excel exports.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🌐 Live Client Portal & GitHub Pages

Clients can access the live portal directly:

- **Live Application URL**: [Open Live Portal](https://ais-pre-pbrje347yfhlfw2qeg5t4b-846168481117.europe-west2.run.app)
- **GitHub Pages Portal URL**: [https://zawitco.github.io/zawitco-legal/](https://zawitco.github.io/zawitco-legal/)
- **Admin Control Center**: Click the **Lock Icon** in the top navigation or navigate to `/admin`
  - **Default Admin PIN**: `123456`

---

## ⚡ GitHub Pages Setup (Fix for Blank Page)

If you are using GitHub Pages, follow these quick steps in your GitHub repository:

### Method A: Deploy from `/docs` folder (Instant, No Actions Needed)
1. On GitHub, go to your repository: `https://github.com/zawitco/zawitco-legal`
2. Click **Settings** (tab at top) -> **Pages** (in left sidebar).
3. Under **Build and deployment** -> **Source**: Select **Deploy from a branch**.
4. Under **Branch**:
   - Select **`main`**
   - In the folder dropdown right next to it, select **`/docs`** (instead of `/ (root)`).
5. Click **Save**.
6. Wait 30–60 seconds, and refresh `https://zawitco.github.io/zawitco-legal/`!

### Method B: Deploy with GitHub Actions
1. Under **Settings** -> **Pages** -> **Source**, choose **GitHub Actions**.
2. GitHub will automatically detect the `.github/workflows/deploy.yml` workflow, run the build, and publish the site.

---

## 🚀 How to Publish This Project to GitHub

Follow these simple steps from your terminal inside the project directory:

### Step 1: Initialize Git
```bash
git init
```

### Step 2: Add Files & Verify `.gitignore`
All sensitive files (`service_account.json`, `.env`, build artifacts) are automatically excluded by `.gitignore`.
```bash
git add .
git commit -m "feat: initial commit for multi-project client portal & KPI scorecard"
```

### Step 3: Link to Your GitHub Repository
1. Go to [GitHub](https://github.com/new) and create a new repository (e.g., `client-kpi-portal`).
2. Run the following commands (replace `<YOUR_USERNAME>` and `<YOUR_REPOSITORY_NAME>` with your GitHub details):

```bash
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

---

## 🔗 How to Share the Portal with Your Client

When sharing with clients, you have two primary options:

### 1. Share the Live Hosted URL (Recommended)
You do not need your client to install Git or run code. Simply share the live link:
- **Direct Portal Link**: `https://ais-pre-pbrje347yfhlfw2qeg5t4b-846168481117.europe-west2.run.app`

### 2. Share a Client-Isolated Token Link (Data Privacy)
If you want a specific client to **only see their own project data** (e.g., Keemart QC, Keemart DC, or Ninja) without seeing other clients' information:
1. Open the portal and click the **Lock Icon** in the top right.
2. Enter the Admin PIN (`123456`).
3. Scroll to **Client Share Links**.
4. Select the client's project (e.g. `Keemart QC`) and generate a secure link.
5. Send that dedicated link (e.g., `https://ais-pre-pbrje347yfhlfw2qeg5t4b-846168481117.europe-west2.run.app/?token=abc123xyz`) to your client. The portal will automatically lock down navigation and only display their project's records and scorecards.

### 3. Deploy Your GitHub Repo to Cloud Hosting (Free & Custom Domain)
If you wish to host the GitHub repository on your own cloud provider:
- **Render / Railway / Fly.io**: Connect your GitHub repository, choose Node.js environment, set build command `npm run build` and start command `npm start`.
- **Google Cloud Run**: Pre-configured container deployment.

---

## ✨ Key Features

- **Hierarchical Project & Sub-Project Matrix**:
  - Automatically identifies projects (`Keemart Dark Store`, `Keemart QC`, `Keemart DC`, `Ninja`, etc.) and sub-projects from spreadsheet headers.
  - Interactive drill-down table with expandable/collapsible project groups.
- **Active Workforce Filtering**:
  - Automatically filters out resigned or inactive employees to ensure KPI metrics represent 100% active operational staff.
- **Automated KPI Compliance Engine**:
  - Calculates real-time scores and status rates across 5 critical compliance pillars:
    - **Ajeer** (Contract authorization)
    - **Health Card** (Baladiya food & retail permits)
    - **Medical Test** (Occupational health checks)
    - **Sponsorship** (Legal transfer verification)
    - **Muqeem** (Residency status)
- **Executive Scorecard & PDF / Excel Export**:
  - **PDF Export**: Generates branded executive report cards containing the summary scorecard, hierarchical project matrix, and employee drill-down tables.
  - **Excel Export**: Structured multi-column spreadsheet download ready for management reporting.
- **Automated Google Sheets Synchronization**:
  - Background synchronization directly with Google Sheets API via Service Account JWT authentication.
  - Resilient local SQLite database (`sql.js`) caching for instant page loads.
- **Admin Control Center**:
  - Real-time column visibility toggles.
  - Custom KPI weightings and threshold adjustments.
  - Master sync trigger with real-time status logging.
  - Main portal lock switch.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**

### 1. Clone the Repository
```bash
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
cd <YOUR_REPOSITORY_NAME>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (Optional)
Copy the example environment file:
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `ADMIN_PIN` | Passcode for Admin Control Panel | `123456` |
| `SPREADSHEET_ID` | Google Sheets ID | Configured in SQLite |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service Account JSON for live sync | Optional |

### 4. Start the Full-Stack Dev Server
```bash
npm run dev
```
The portal will be live at `http://localhost:3000`.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 📁 Project Architecture

```
├── server.ts                  # Express server & API endpoints (/api/portal-data, /api/admin/*)
├── portal_data.db             # Pre-seeded SQLite database with 1,140+ active employee records
├── index.html                 # Single-page HTML shell with extension error filters
├── vite.config.ts             # Vite configuration with React & Tailwind CSS v4
├── package.json               # Project manifest, scripts, and dependencies
├── src/
│   ├── main.tsx               # Client entry point
│   ├── App.tsx                # Executive portal UI, state management, search & filters
│   ├── components/
│   │   ├── SubProjectMatrix.tsx  # Hierarchical Project & Sub-Project breakdown table
│   │   ├── EmployeeTable.tsx     # Drill-down individual employee compliance table
│   │   └── AdminPanel.tsx        # Secure admin control center & sync manager
│   ├── utils/
│   │   ├── kpiEngine.ts          # KPI scoring algorithms & hierarchical aggregation
│   │   └── reportExport.ts       # PDF (jsPDF-autotable) & Excel (xlsx) generators
│   └── server/
│       ├── db.ts                 # sql.js SQLite persistence layer & schema definitions
│       └── sync.ts               # Google Sheets API connector & JWT authentication
```

---

## 🔒 Security & Privacy

- **No Secrets in Repository**: Google Cloud Service Account private keys are strictly loaded via environment variables or local gitignored credentials files.
- **Project Isolation**: Client share links enforce strict server-side row sanitization, stripping unauthorized projects and sub-projects before sending data over the network.
- **PIN Protection**: Administrative endpoints require verification with the custom admin PIN header (`x-admin-pin`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
