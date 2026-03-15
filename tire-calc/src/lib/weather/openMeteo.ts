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
