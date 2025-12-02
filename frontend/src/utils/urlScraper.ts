interface ScrapedData {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
}

// Backend API URL - hardcoded for production deployment
const BACKEND_URL = 'https://backend-fu5727b1p-ramsaptamis-projects.vercel.app';

export async function scrapeProductUrl(url: string): Promise<ScrapedData> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Frontend fallback: handle ImageObject if backend returns object instead of string
    if (data.imageUrl && typeof data.imageUrl === 'object') {
      data.imageUrl = data.imageUrl.url || data.imageUrl.image || data.imageUrl.contentUrl || '';
    }

    return data;
  } catch (error) {
    return {};
  }
}
