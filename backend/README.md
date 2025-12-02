# Moodboard Backend API

Backend scraping service for the Canva Moodboard app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to Vercel:
```bash
vercel --prod
```

## API Endpoint

**POST /api/scrape**

Request body:
```json
{
  "url": "https://example.com/product"
}
```

Response:
```json
{
  "title": "Product Name",
  "brandName": "Brand Name",
  "price": "99.99",
  "currency": "USD",
  "imageUrl": "https://example.com/image.jpg"
}
```

## Local Development

```bash
npm run dev
```

Server will run at http://localhost:3000
