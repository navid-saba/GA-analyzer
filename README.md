# Gemini Data Analyzer

A local web application that allows users to upload Google Analytics data (CSV/Excel) and uses the Gemini API to analyze the data, extract insights, and generate a podcast script that can be synthesized into audio.

## Tech Stack
- **Backend:** Python + FastAPI
- **Frontend:** React + Next.js
- **AI:** Google Gemini API (analysis + script), ElevenLabs (MP3 podcast audio)
- **Data Parsing:** pandas

## Prerequisites
- **Python:** 3.10+
- **Node.js:** 18+

## Setup Instructions

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Install the dependencies:
```bash
pip install -r requirements.txt
```

Set up your environment variables:
1. Copy the example `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your API keys (see `.env.example`):
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ELEVENLABS_VOICE_ID=your_voice_id_here
   ```

Run the backend server:
```bash
uvicorn main:app --reload
```
The backend will run on `http://localhost:8000`.

### 2. Frontend Setup

Navigate to the frontend directory:
```bash
cd frontend
```

Install the dependencies:
```bash
npm install
cp .env.local.example .env.local
```

Run the frontend development server:
```bash
npm run dev
```
The frontend will run on `http://localhost:3000`.

## Usage
1. Open `http://localhost:3000` in your browser.
2. Upload a Google Analytics CSV or Excel file.
3. Click **Analyse** to process the data and view insights.
4. Click **Generate Podcast Audio** to create an MP3, play it in the browser, or download it.

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Vercel + Render setup (recommended) and AWS comparison.
