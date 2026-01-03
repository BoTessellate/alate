'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Droplets, CloudFog } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  location: string;
}

// Weather code to icon and description mapping (WMO codes)
const getWeatherInfo = (code: number): { icon: React.ReactNode; description: string } => {
  const iconProps = { size: 20, strokeWidth: 1.5 };

  if (code === 0) return { icon: <Sun {...iconProps} />, description: 'Clear' };
  if (code <= 3) return { icon: <Cloud {...iconProps} />, description: 'Partly cloudy' };
  if (code <= 49) return { icon: <CloudFog {...iconProps} />, description: 'Foggy' };
  if (code <= 59) return { icon: <Droplets {...iconProps} />, description: 'Drizzle' };
  if (code <= 69) return { icon: <CloudRain {...iconProps} />, description: 'Rain' };
  if (code <= 79) return { icon: <CloudSnow {...iconProps} />, description: 'Snow' };
  if (code <= 84) return { icon: <CloudRain {...iconProps} />, description: 'Showers' };
  if (code <= 94) return { icon: <CloudSnow {...iconProps} />, description: 'Snow showers' };
  if (code <= 99) return { icon: <CloudLightning {...iconProps} />, description: 'Thunderstorm' };
  return { icon: <Cloud {...iconProps} />, description: 'Cloudy' };
};

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Get location from IP (no permission needed)
        // ip-api.com provides free IP geolocation
        const ipRes = await fetch('http://ip-api.com/json/?fields=status,city,lat,lon');

        if (!ipRes.ok) throw new Error('IP geolocation failed');

        const ipData = await ipRes.json();

        if (ipData.status !== 'success') {
          throw new Error('IP geolocation failed');
        }

        const { lat: latitude, lon: longitude, city: locationName } = ipData;

        // Fetch weather from Open-Meteo (free, no API key required)
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`
        );

        if (!weatherRes.ok) throw new Error('Weather fetch failed');

        const weatherData = await weatherRes.json();

        setWeather({
          temperature: Math.round(weatherData.current.temperature_2m),
          weatherCode: weatherData.current.weather_code,
          humidity: weatherData.current.relative_humidity_2m,
          windSpeed: Math.round(weatherData.current.wind_speed_10m),
          location: locationName || 'Your Location',
        });
      } catch {
        setError('Weather unavailable');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
      >
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
        <div className="w-16 h-3 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
      </div>
    );
  }

  if (error || !weather) {
    return null; // Silently hide if no weather available
  }

  const { icon, description } = getWeatherInfo(weather.weatherCode);

  return (
    <div
      className="inline-flex items-center gap-3 px-4 py-2 rounded-full"
      style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        color: 'var(--foreground)',
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--foreground-secondary)' }}>{icon}</span>
        <span
          className="text-2xl font-light"
          style={{ fontFamily: 'var(--font-cormorant)' }}
        >
          {weather.temperature}°
        </span>
      </div>

      <div className="h-6 w-px" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />

      <div className="flex flex-col">
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
        >
          {weather.location}
        </span>
        <span
          className="text-xs"
          style={{ color: 'var(--foreground-muted)', lineHeight: 1.2 }}
        >
          {description}
        </span>
      </div>
    </div>
  );
}

export default WeatherWidget;
