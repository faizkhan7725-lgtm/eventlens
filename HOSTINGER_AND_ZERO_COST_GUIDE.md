# 🚀 EventLens Production Deployment & Architecture Blueprint
**Focus:** Mobile-First Experience | ₹0 / Zero Extra Cost Architecture

---

## 1. 🏗️ Best Architecture: The Free Hybrid Cloud

Since you already own **Hostinger Business Web Hosting**, this architecture makes **100% full use of your Hostinger plan** while remaining **₹0 completely free** for AI, Database, and Background Processing.

```
┌────────────────────────────────────────────────────────┐
│  Hostinger Business Web Hosting (Node.js)             │
│  • Custom Domain (e.g. eventlens.in)                   │
│  • Free Hostinger SSL                                  │
│  • Next.js 16 App Router (Standalone Mode: ~80MB RAM)  │
│  • Mobile Selfie Scanner, Moment Search, QR Studio     │
└───────────────────────────┬────────────────────────────┘
                            │ API Requests (REST)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Render.com / Koyeb / Fly.io (Free Tier Docker)        │
│  • FastAPI Python 3.11 Backend                         │
│  • InsightFace AI Facial Recognition Engine            │
│  • Google Gemini 2.5 Flash (Free AI Vision Curation)   │
└───────────────────────────┬────────────────────────────┘
                            │ Vector Embeddings (512-d)
                            ▼
┌────────────────────────────────────────────────────────┐
│  Supabase (Free Tier PostgreSQL)                       │
│  • Native pgvector extension (Cosine Distance Search)  │
│  • 500 MB Free Storage (Supports ~100,000+ faces)      │
│  • High-performance connection pooler                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. 📱 Hostinger Node.js Deployment Steps (Frontend)

Hostinger Business Hosting has a **Node.js** app manager in hPanel.

### Step 1: Build the Standalone Bundle
On your local machine or via CI/CD:
```bash
cd frontend
npm run build
```
This produces `.next/standalone/` which contains a complete, ultra-lightweight Node.js web server.

### Step 2: Upload Files to Hostinger
1. Log into **Hostinger hPanel** -> **File Manager**.
2. Go to `domains/yourdomain.com/public_html/`.
3. Upload:
   - The contents of `.next/standalone` (including `server.js`).
   - The `.next/static` folder placed inside `.next/static`.
   - The `public` folder.
   - `.env.production` containing:
     ```env
     NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
     NEXT_PUBLIC_SITE_URL=https://yourdomain.com
     NEXT_PUBLIC_APP_NAME=EventLens
     ```

### Step 3: Configure Hostinger Node.js Manager
1. In hPanel, search for **Node.js**.
2. **Node.js version:** Select `20.x` or `22.x`.
3. **Application root:** `/home/uXXXX/domains/yourdomain.com/public_html`
4. **Application startup file:** `server.js`
5. Click **Save** & **Run/Restart**.
6. Visit your domain — your EventLens web app is live with SSL!

---

## 3. 🗄️ Database Setup: Supabase (Free 500MB pgvector)

1. Sign up free at [supabase.com](https://supabase.com).
2. Create a new project (e.g., `eventlens-db`).
3. Go to **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Copy the connection string from **Project Settings -> Database**:
   ```
   postgresql+psycopg://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

---

## 4. 🧠 Backend Setup: Render.com (Free Web Service)

1. Sign up free at [render.com](https://render.com).
2. Click **New +** -> **Web Service** -> Connect your GitHub repo.
3. Select **Docker** environment (Render automatically detects `backend/Dockerfile`).
4. In **Environment Variables**, add:
   - `DATABASE_URL`: Your Supabase connection string.
   - `GEMINI_API_KEY`: Your free Gemini API key from Google AI Studio.
   - `APP_SECRET_KEY`: A secure random 32-character string.
   - `ENVIRONMENT`: `production`
   - `STORAGE_BACKEND`: `local` (or attach free Cloudflare R2 / AWS S3 bucket).
5. Click **Deploy**. Render gives you a live HTTPS URL (e.g. `https://eventlens-api.onrender.com`).

---

## 5. 🛠️ All-In-One Alternative: Hostinger KVM VPS

If in the future you want **all 3 components on Hostinger directly in one single box**:
1. In Hostinger hPanel, ask support to switch your Business Hosting credit to a **Hostinger KVM 1 or KVM 2 VPS** (Ubuntu 24.04).
2. On the VPS, simply run:
   ```bash
   git clone https://github.com/your-repo/eventlens.git
   cd eventlens
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   Everything (Next.js, FastAPI, Celery, Redis, pgvector PostgreSQL) starts automatically with 1 command!
