# Fit Check

AI-powered clothing fit prediction — paste a product URL, get instant fit analysis against your body profile.

## Structure

- **`mobile/`** — Expo/React Native app (iOS + Android)
- **`backend/`** — Vercel serverless functions (scraping, AI enrichment, fit check API)

## Tech Stack

- **Mobile:** React Native, Expo, TypeScript, Zustand
- **Backend:** Vercel Serverless, Node.js
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude

## Development

```bash
# Mobile app
cd mobile && npm install && npx expo start

# Backend
cd backend && npm install && npx vercel dev
```

## License

MIT
