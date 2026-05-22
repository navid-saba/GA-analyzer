# Deployment guide

## Vercel + Render vs AWS (for this prototype)

| | **Vercel (frontend) + Render (backend)** | **AWS (Lightsail / App Runner / Amplify)** |
|--|------------------------------------------|-------------------------------------------|
| **Time to first URL** | ~30–60 minutes | Often half a day+ |
| **Complexity** | Low — connect GitHub, set env vars | Medium–high — IAM, networking, build specs |
| **Cost (demo)** | Free tiers often enough | Lightsail ~$5/mo minimum; App Runner ~$5–15+ |
| **Next.js fit** | Excellent on Vercel | Good on Amplify; more config |
| **Python/FastAPI** | Not on Vercel — use Render/Railway | ECS, App Runner, Elastic Beanstalk |
| **HTTPS** | Automatic | Automatic with ALB / CloudFront |
| **Best for** | Showing a prototype to business stakeholders quickly | Company policy requires AWS, or scaling later |

### Recommendation

**Use Vercel for the frontend and Render for the backend** for this demo. Move to AWS when you need VPC, compliance, or org-standard hosting.

---

## Prerequisites

1. GitHub repo with this code (do **not** commit `.env` files).
2. Accounts: [GitHub](https://github.com), [Render](https://render.com), [Vercel](https://vercel.com).

---

## Step 1 — Deploy backend (Render)

1. Push code to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** (or **Web Service**).
3. Connect the repo.
4. If using **Web Service** manually:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment variables:**

   | Key | Value |
   |-----|--------|
   | `GEMINI_API_KEY` | your key |
   | `ELEVENLABS_API_KEY` | your key |
   | `ELEVENLABS_VOICE_ID` | your voice id |
   | `ELEVENLABS_MODEL_ID` | `eleven_multilingual_v2` (optional) |
   | `ALLOWED_ORIGINS` | leave `*` for first deploy, then set to your Vercel URL |

6. Deploy and copy the service URL, e.g. `https://muti-agent-api.onrender.com`.
7. Test: open `https://YOUR-API.onrender.com/health` — should return `{"status":"ok"}`.

> Free Render services sleep after inactivity; the first request may take ~30s to wake.

---

## Step 2 — Deploy frontend (Vercel)

1. [Vercel Dashboard](https://vercel.com/new) → **Import** your GitHub repo.
2. **Root Directory:** `frontend`
3. Framework preset: **Next.js** (auto-detected).
4. **Environment variable:**

   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_API_URL` | `https://muti-agent-api.onrender.com` (your Render URL, no trailing slash) |

5. Deploy.
6. Copy your Vercel URL, e.g. `https://muti-agent.vercel.app`.

---

## Step 3 — Lock down CORS (optional but recommended)

On Render, set:

```
ALLOWED_ORIGINS=https://muti-agent.vercel.app
```

Redeploy the backend. Only your Vercel site can call the API from the browser.

---

## Step 4 — Smoke test

1. Open the Vercel URL.
2. Upload a sample CSV.
3. Click **Analyse Data** — wait for tables and script.
4. Click **Generate Podcast Audio** — wait (can take 1–2 min for long scripts).
5. Play in the browser player and **Download MP3**.

---

## If you must use AWS later

| AWS option | Use when |
|------------|----------|
| **Amplify** | Host Next.js only; keep API on Render or **Lambda + API Gateway** |
| **App Runner** | Run FastAPI in a container with minimal ops |
| **Lightsail** | One $5 VM running both with nginx — simplest “all on AWS” |

Rough steps for **Lightsail**: create Ubuntu instance → install Python 3.11, Node 18 → clone repo → run uvicorn + `npm run build && npm start` → nginx reverse proxy on port 80 → attach static IP.

---

## Local development (unchanged)

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2 — frontend
cd frontend
cp .env.local.example .env.local   # or set NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Open http://localhost:3000
