'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Droplets, CloudFog } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  location: string;
}

// Weather code to icon and description mapping (WMO codes)
const getWeatherInfo = (code: number): { icon: React.ReactNode; description: string } => {
  const iconProps = { size: 20, strokeWidth: 1.5 };

  if (code === 0) return { icon: <Sun {...iconProps} />, description: 'Clear sky' };
  if (code <= 3) return { icon: <Cloud {...iconProps} />, description: 'Partly cloudy' };
  if (code <= 49) return { icon: <CloudFog {...iconProps} />, description: 'Foggy' };
  if (code <= 59) return { icon: <Droplets {...iconProps} />, description: 'Drizzle' };
  if (code <= 69) return { icon: <CloudRain {...iconProps} />, description: 'Rainy' };
  if (code <= 79) return { icon: <CloudSnow {...iconProps} />, description: 'Snowy' };
  if (code <= 84) return { icon: <CloudRain {...iconProps} />, description: 'Showers' };
  if (code <= 94) return { icon: <CloudSnow {...iconProps} />, description: 'Snow showers' };
  if (code <= 99) return { icon: <CloudLightning {...iconProps} />, description: 'Thunderstorm' };
  return { icon: <Cloud {...iconProps} />, description: 'Cloudy' };
};

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const { userLocation, setUserLocation } = useSettingsStore();

  useEffect(() => {
    const fetchWeatherForCoords = async (lat: number, lng: number, city: string) => {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`
      );
      if (!weatherRes.ok) throw new Error('Weather fetch failed');
      const weatherData = await weatherRes.json();
      setWeather({
        temperature: Math.round(weatherData.current.temperature_2m),
        weatherCode: weatherData.current.weather_code,
        location: city,
      });
    };

    const getCityFromCoords = async (lat: number, lng: number): Promise<string> => {
      try {
        // Use BigDataCloud for accurate reverse geocoding (free, no API key)
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          // Return city name, or locality, or principal subdivision
          return data.city || data.locality || data.principalSubdivision || 'Your Location';
        }
      } catch {
        // Fallback: try Nominatim (OpenStreetMap)
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'User-Agent': 'TheMoodLayer/1.0' } }
          );
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            return osmData.address?.city || osmData.address?.town || osmData.address?.village || 'Your Location';
          }
        } catch {
          // Ignore fallback errors
        }
      }
      return 'Your Location';
    };

    const fallbackToIpGeolocation = async () => {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (!ipRes.ok) throw new Error('IP geolocation failed');
      const ipData = await ipRes.json();
      const { latitude, longitude, city } = ipData;
      if (!latitude || !longitude) throw new Error('No coordinates');
      await fetchWeatherForCoords(latitude, longitude, city || 'Your Location');
    };

    const fetchWeather = async () => {
      try {
        // 1. Use cached location if available
        if (userLocation) {
          await fetchWeatherForCoords(
            userLocation.latitude,
            userLocation.longitude,
            userLocation.city
          );
          return;
        }

        // 2. Try browser geolocation (more accurate)
        if ('geolocation' in navigator) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
              });
            });

            const { latitude, longitude } = position.coords;
            const city = await getCityFromCoords(latitude, longitude);

            // Cache the location
            setUserLocation({ latitude, longitude, city });
            await fetchWeatherForCoords(latitude, longitude, city);
            return;
          } catch {
            // Geolocation denied or failed, fall back to IP
          }
        }

        // 3. Fall back to IP geolocation
        await fallbackToIpGeolocation();
      } catch {
        // Silently fail - widget just won't show
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [userLocation, setUserLocation]);

  if (loading) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div
          className="w-5 h-5 rounded"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <div
          className="w-8 h-6 rounded"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <div className="flex flex-col gap-1">
          <div
            className="w-16 h-4 rounded"
            style={{ backgroundColor: 'var(--border)' }}
          />
          <div
            className="w-20 h-3 rounded"
            style={{ backgroundColor: 'var(--border)' }}
          />
        </div>
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  const { icon, description } = getWeatherInfo(weather.weatherCode);

  // Elegant horizontal layout: icon | temperature | location+description
  return (
    <div className="flex items-center gap-4">
      {/* Weather Icon */}
      <div style={{ color: 'var(--foreground-muted)' }}>
        {icon}
      </div>

      {/* Temperature */}
      <span
        className="text-2xl"
        style={{
          color: 'var(--foreground)',
          fontFamily: 'var(--font-cormorant)',
          fontWeight: 400,
          lineHeight: 1,
        }}
      >
        {weather.temperature}°
      </span>

      {/* Location and Description */}
      <div className="flex flex-col">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
        >
          {weather.location}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--foreground-muted)' }}
        >
          {description}
        </span>
      </div>
    </div>
  );
}

export default WeatherWidget;
