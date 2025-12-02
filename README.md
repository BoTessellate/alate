# Canva Moodboard Brand Tagger

A Canva app for tagging moodboard images with brand information, pricing, and product details.

## Project Structure

```
moodboard-app/
├── frontend/          # Canva app (React + TypeScript)
├── backend/           # Scraping API (Vercel serverless)
└── README.md
```

## Features

- ✅ Auto-detect image selection in Canva
- ✅ Tag images with brand, product, price, currency
- ✅ URL scraping for auto-fill
- ✅ Export tagged data as JSON
- ✅ Free tier: 10 tagged images
- ✅ Currency support for global products

## Setup

### Frontend (Canva App)

```bash
cd frontend
npm install
npm start
```

Access at: http://localhost:8080

### Backend (Vercel API)

```bash
cd backend
npm install
npm run dev
```

API runs at: http://localhost:3000

## Deployment

### Backend (Already Deployed)

Backend is deployed at: https://backend-btumuop8r-ramsaptamis-projects.vercel.app

To redeploy:
```bash
cd backend
vercel --prod --yes
```

### Frontend Environment Setup

Copy `.env.example` to `.env` in the frontend folder and update with your Canva App ID:
```bash
cd frontend
cp .env.example .env
```

The backend URL is already configured in `.env.example`

## Tech Stack

- **Frontend**: React 19, TypeScript, Canva Apps SDK v2
- **Backend**: Node.js, Vercel Serverless Functions
- **Storage**: LocalStorage (frontend)
- **Deployment**: Vercel

## License

MIT
