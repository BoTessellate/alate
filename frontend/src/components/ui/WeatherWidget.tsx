'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Droplets, CloudFog } from 'lucide-react';

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

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Use ipapi.co (HTTPS, free tier)
        const ipRes = await fetch('https://ipapi.co/json/');

        if (!ipRes.ok) throw new Error('IP geolocation failed');

        const ipData = await ipRes.json();
        const { latitude, longitude, city } = ipData;

        if (!latitude || !longitude) throw new Error('No coordinates');

        // Fetch weather from Open-Meteo
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
        );

        if (!weatherRes.ok) throw new Error('Weather fetch failed');

        const weatherData = await weatherRes.json();

        setWeather({
          temperature: Math.round(weatherData.current.temperature_2m),
          weatherCode: weatherData.current.weather_code,
          location: city || 'Your Location',
        });
      } catch {
        // Silently fail - widget just won't show
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

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
