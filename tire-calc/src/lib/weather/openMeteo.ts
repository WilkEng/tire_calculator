// ─── Open-Meteo Weather Service ────────────────────────────────────
//
// Fetches forecast and historical weather from Open-Meteo (free, no API key).
// Provides ambient temp, cloud cover, wind speed, shortwave radiation, humidity.
// Includes asphalt temperature estimator with bias correction.
// ────────────────────────────────────────────────────────────────────

import type { WeatherSnapshot } from "../domain/models";
import { generateId, nowISO } from "../utils/helpers";

// ─── Open-Meteo API types ──────────────────────────────────────────

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  cloud_cover: number[];
  wind_speed_10m: number[];
  shortwave_radiation: number[];
  relative_humidity_2m: number[];
}

interface OpenMeteoForecastResponse {
  hourly: OpenMeteoHourly;
}

// ─── Public types ──────────────────────────────────────────────────

export interface WeatherForecastPoint {
  time: string;
  ambient: number;
  cloudCover: number;
  windSpeed: number;
  shortwaveRadiation: number;
  humidity: number;
}

export interface AsphaltEstimate {
  estimated: number;
  /** If a measured value was provided, the bias for correction */
  biasCorrection: number;
  method: "estimated" | "measured" | "bias-corrected";
}

// ─── Forecast Fetch ────────────────────────────────────────────────

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

/**
 * Fetch hourly weather forecast for the next 48 hours.
 */
export async function fetchForecast(
  latitude: number,
  longitude: number
): Promise<WeatherForecastPoint[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly:
      "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation,relative_humidity_2m",
    forecast_days: "2",
    timezone: "auto",
  });

  const res = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast error: ${res.status} ${res.statusText}`);
  }

  const data: OpenMeteoForecastResponse = await res.json();
  return mapHourly(data.hourly);
}

/**
 * Fetch historical weather for a specific date range.
 */
export async function fetchHistorical(
  latitude: number,
  longitude: number,
  startDate: string, // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
): Promise<WeatherForecastPoint[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly:
      "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation,relative_humidity_2m",
    start_date: startDate,
    end_date: endDate,
    timezone: "auto",
  });

  const res = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo archive error: ${res.status} ${res.statusText}`);
  }

  const data: OpenMeteoForecastResponse = await res.json();
  return mapHourly(data.hourly);
}

/**
 * Get the forecast point closest to a specific time.
 */
export function findNearestForecast(
  points: WeatherForecastPoint[],
  targetTime: Date
): WeatherForecastPoint | undefined {
  if (points.length === 0) return undefined;

  let best = points[0];
  let bestDiff = Math.abs(
    new Date(best.time).getTime() - targetTime.getTime()
  );

  for (const p of points) {
    const diff = Math.abs(new Date(p.time).getTime() - targetTime.getTime());
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }

  return best;
}

/**
 * Convert a forecast point to a WeatherSnapshot domain object.
 */
export function forecastPointToSnapshot(
  point: WeatherForecastPoint
): WeatherSnapshot {
  return {
    id: generateId(),
    timestamp: point.time,
    source: "open-meteo-forecast",
    ambient: point.ambient,
    cloudCover: point.cloudCover,
    windSpeed: point.windSpeed,
    shortwaveRadiation: point.shortwaveRadiation,
    humidity: point.humidity,
  };
}

// ─── Asphalt Temperature Estimator ─────────────────────────────────

/**
 * Estimate asphalt temperature from weather variables.
 *
 * Simple empirical model:
 *   asphaltEst = ambient + (radiation / 100) * radiationFactor
 *              - windCooling * windSpeed
 *              + (1 - cloudCover/100) * clearSkyBonus
 *
 * Defaults are calibrated for typical European racing conditions.
 */
export function estimateAsphaltTemp(
  ambient: number,
  shortwaveRadiation: number,
  windSpeed: number,
  cloudCover: number,
  options?: {
    radiationFactor?: number; // default 5.0
    windCooling?: number; // default 0.5
    clearSkyBonus?: number; // default 3.0
  }
): number {
  const radiationFactor = options?.radiationFactor ?? 5.0;
  const windCooling = options?.windCooling ?? 0.5;
  const clearSkyBonus = options?.clearSkyBonus ?? 3.0;

  return (
    ambient +
    (shortwaveRadiation / 100) * radiationFactor -
    windCooling * windSpeed +
    (1 - cloudCover / 100) * clearSkyBonus
  );
}

/**
 * Compute a bias-corrected asphalt estimate.
 *
 * If a measured asphalt value is available, compute the bias between
 * estimated and measured, and apply it to future estimates.
 */
export function computeAsphaltWithBias(
  estimated: number,
  measuredAsphalt?: number,
  existingBias: number = 0
): AsphaltEstimate {
  if (measuredAsphalt != null) {
    const newBias = measuredAsphalt - estimated;
    return {
      estimated: measuredAsphalt,
      biasCorrection: newBias,
      method: "measured",
    };
  }

  if (existingBias !== 0) {
    return {
      estimated: estimated + existingBias,
      biasCorrection: existingBias,
      method: "bias-corrected",
    };
  }

  return {
    estimated,
    biasCorrection: 0,
    method: "estimated",
  };
}

// ─── Geolocation ───────────────────────────────────────────────────

/**
 * Get the user's current position via browser geolocation API.
 */
export function getUserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(err),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

/**
 * Search for a location by name using Open-Meteo geocoding.
 */
export async function searchLocation(
  query: string
): Promise<{ name: string; latitude: number; longitude: number; country: string }[]> {
  const params = new URLSearchParams({
    name: query,
    count: "5",
    language: "en",
    format: "json",
  });

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`
  );
  if (!res.ok) return [];

  const data = await res.json();
  if (!data.results) return [];

  return data.results.map(
    (r: { name: string; latitude: number; longitude: number; country: string }) => ({
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      country: r.country,
    })
  );
}

// ─── Today's Forecast & Chart Lines ────────────────────────────────

export interface ChartDataPoint {
  /** ISO time string */
  time: string;
  /** Hour label e.g. "14:00" */
  hour: string;
  /** epoch ms for sorting */
  epoch: number;
  apiAmbient?: number;
  apiAsphalt?: number;
  userAmbient?: number;
  userAsphalt?: number;
}

export interface HourlyCardData {
  time: string;
  hour: string;
  temp: number;
  cloudCover: number;
  humidity: number;
  windSpeed: number;
  icon: "sunny" | "partly-cloudy" | "cloudy" | "rain";
  rainLikely: boolean;
}

/**
 * Fetch today's full-day forecast filtered to today's date.
 * Returns 24h of data (or as many hours as available).
 */
export async function fetchTodayForecast(
  latitude: number,
  longitude: number
): Promise<WeatherForecastPoint[]> {
  const all = await fetchForecast(latitude, longitude);
  const todayStr = new Date().toISOString().slice(0, 10);
  return all.filter((p) => p.time.startsWith(todayStr));
}

/**
 * Build the asphalt temperature estimate line from forecast points.
 */
export function buildAsphaltForecastLine(
  points: WeatherForecastPoint[]
): { time: string; asphalt: number }[] {
  return points.map((p) => ({
    time: p.time,
    asphalt: estimateAsphaltTemp(
      p.ambient,
      p.shortwaveRadiation,
      p.windSpeed,
      p.cloudCover
    ),
  }));
}

/**
 * Build full chart data from forecast points + optional user overrides.
 *
 * Offset model: for each user override, compute the diff between user value
 * and the API value at the nearest forecast time. The most recent override's
 * offset is applied to all forecast points to produce the user-corrected line.
 */
export function buildChartData(
  forecastPoints: WeatherForecastPoint[],
  userOverrides?: { timestamp: string; ambientOverride?: number; asphaltOverride?: number }[]
): ChartDataPoint[] {
  if (forecastPoints.length === 0) return [];

  // Calculate user offsets from the most recent override
  let ambientOffset: number | null = null;
  let asphaltOffset: number | null = null;

  if (userOverrides && userOverrides.length > 0) {
    // Sort overrides by time, most recent last
    const sorted = [...userOverrides].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Find most recent ambient override
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].ambientOverride != null) {
        const nearest = findNearestForecast(forecastPoints, new Date(sorted[i].timestamp));
        if (nearest) {
          ambientOffset = sorted[i].ambientOverride! - nearest.ambient;
        }
        break;
      }
    }

    // Find most recent asphalt override
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].asphaltOverride != null) {
        const nearest = findNearestForecast(forecastPoints, new Date(sorted[i].timestamp));
        if (nearest) {
          const apiAsphalt = estimateAsphaltTemp(
            nearest.ambient,
            nearest.shortwaveRadiation,
            nearest.windSpeed,
            nearest.cloudCover
          );
          asphaltOffset = sorted[i].asphaltOverride! - apiAsphalt;
        }
        break;
      }
    }
  }

  return forecastPoints.map((p) => {
    const dt = new Date(p.time);
    const apiAsphalt = estimateAsphaltTemp(
      p.ambient,
      p.shortwaveRadiation,
      p.windSpeed,
      p.cloudCover
    );

    const point: ChartDataPoint = {
      time: p.time,
      hour: `${dt.getHours().toString().padStart(2, "0")}:00`,
      epoch: dt.getTime(),
      apiAmbient: p.ambient,
      apiAsphalt: Math.round(apiAsphalt * 10) / 10,
    };

    if (ambientOffset !== null) {
      point.userAmbient = Math.round((p.ambient + ambientOffset) * 10) / 10;
    }
    if (asphaltOffset !== null) {
      point.userAsphalt = Math.round((apiAsphalt + asphaltOffset) * 10) / 10;
    }

    return point;
  });
}

/**
 * Build hourly card data for the iOS-style weather card.
 */
export function buildHourlyCards(
  forecastPoints: WeatherForecastPoint[]
): HourlyCardData[] {
  return forecastPoints.map((p) => {
    const dt = new Date(p.time);
    const rainLikely = p.humidity > 85 && p.cloudCover > 60;
    let icon: HourlyCardData["icon"] = "sunny";
    if (rainLikely) icon = "rain";
    else if (p.cloudCover > 80) icon = "cloudy";
    else if (p.cloudCover > 40) icon = "partly-cloudy";

    return {
      time: p.time,
      hour: `${dt.getHours().toString().padStart(2, "0")}:00`,
      temp: Math.round(p.ambient),
      cloudCover: p.cloudCover,
      humidity: p.humidity,
      windSpeed: p.windSpeed,
      icon,
      rainLikely,
    };
  });
}

// ─── Helpers ───────────────────────────────────────────────────────

function mapHourly(hourly: OpenMeteoHourly): WeatherForecastPoint[] {
  return hourly.time.map((t, i) => ({
    time: t,
    ambient: hourly.temperature_2m[i],
    cloudCover: hourly.cloud_cover[i],
    windSpeed: hourly.wind_speed_10m[i],
    shortwaveRadiation: hourly.shortwave_radiation[i],
    humidity: hourly.relative_humidity_2m[i],
  }));
}
