'use client';

import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Droplets, CloudFog, MapPin } from 'lucide-react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  location: string;
}

// Weather code to icon and description mapping (WMO codes)
const getWeatherInfo = (code: number): { icon: React.ReactNode; description: string } => {
  const iconProps = { size: 18, strokeWidth: 1.5 };

  if (code === 0) return { icon: <Sun {...iconProps} />, description: 'Clear' };
  if (code <= 3) return { icon: <Cloud {...iconProps} />, description: 'Cloudy' };
  if (code <= 49) return { icon: <CloudFog {...iconProps} />, description: 'Fog' };
  if (code <= 59) return { icon: <Droplets {...iconProps} />, description: 'Drizzle' };
  if (code <= 69) return { icon: <CloudRain {...iconProps} />, description: 'Rain' };
  if (code <= 79) return { icon: <CloudSnow {...iconProps} />, description: 'Snow' };
  if (code <= 84) return { icon: <CloudRain {...iconProps} />, description: 'Showers' };
  if (code <= 94) return { icon: <CloudSnow {...iconProps} />, description: 'Snow' };
  if (code <= 99) return { icon: <CloudLightning {...iconProps} />, description: 'Storm' };
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
      <div className="flex items-center gap-3 animate-pulse">
        <div
          className="w-5 h-5 rounded-full"
          style={{ backgroundColor: 'var(--border)' }}
        />
        <div className="flex flex-col gap-1">
          <div
            className="w-12 h-5 rounded"
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

  return (
    <div className="flex items-center gap-3">
      {/* Weather Icon */}
      <div style={{ color: 'var(--primary)' }}>
        {icon}
      </div>

      {/* Temperature and Location */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-xl font-medium"
            style={{
              color: 'var(--foreground)',
              fontFamily: 'var(--font-cormorant)',
              lineHeight: 1,
            }}
          >
            {weather.temperature}°C
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {description}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin size={10} style={{ color: 'var(--foreground-muted)' }} />
          <span
            className="text-xs"
            style={{ color: 'var(--foreground-muted)' }}
          >
            {weather.location}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
