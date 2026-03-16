"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchTodayForecast,
  buildChartData,
  buildHourlyCards,
  estimateAsphaltTemp,
} from "@/lib/weather/openMeteo";
import type {
  WeatherForecastPoint,
  ChartDataPoint,
  HourlyCardData,
} from "@/lib/weather/openMeteo";
import type { UserWeatherOverride } from "@/lib/domain/models";

interface UseWeatherForecastResult {
  /** Raw forecast points from the API */
  forecastPoints: WeatherForecastPoint[];
  /** Processed chart data with API + user-offset lines */
  chartData: ChartDataPoint[];
  /** Hourly cards for iOS-style weather display */
  hourlyCards: HourlyCardData[];
  /** Current conditions from nearest forecast point */
  currentConditions: {
    ambient: number;
    asphalt: number;
    cloudCover: number;
    windSpeed: number;
    humidity: number;
  } | null;
  /** Get forecast conditions at a specific time (nearest point interpolation) */
  getForecastAtTime: (time: Date) => { ambient: number; asphalt: number } | null;
  /** Whether forecast is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refetch */
  refetch: () => void;
}

/** Cache duration in ms (10 minutes) */
const CACHE_TTL = 10 * 60 * 1000;

interface CachedForecast {
  key: string;
  points: WeatherForecastPoint[];
  fetchedAt: number;
}

let _cache: CachedForecast | null = null;

/**
 * Hook that fetches today's weather forecast and builds chart + card data.
 *
 * - Caches the API call for 10 min per lat/lng pair.
 * - Recomputes chart data whenever userOverrides change (no re-fetch needed).
 * - Provides current conditions from the nearest forecast point.
 */
export function useWeatherForecast(
  latitude: number | undefined,
  longitude: number | undefined,
  userOverrides?: UserWeatherOverride[],
  activeStintId?: string
): UseWeatherForecastResult {
  const [forecastPoints, setForecastPoints] = useState<WeatherForecastPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const cacheKey =
    latitude != null && longitude != null
      ? `${latitude.toFixed(4)},${longitude.toFixed(4)}`
      : "";

  const doFetch = useCallback(async () => {
    if (latitude == null || longitude == null) return;

    // Check cache
    if (
      _cache &&
      _cache.key === cacheKey &&
      Date.now() - _cache.fetchedAt < CACHE_TTL
    ) {
      setForecastPoints(_cache.points);
      return;
    }

    const id = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const points = await fetchTodayForecast(latitude, longitude);
      // Only update if this is still the latest request
      if (id === fetchIdRef.current) {
        setForecastPoints(points);
        _cache = { key: cacheKey, points, fetchedAt: Date.now() };
      }
    } catch (e) {
      if (id === fetchIdRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (id === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [latitude, longitude, cacheKey]);

  // Fetch on mount and when coordinates change
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Build chart data — recalculates when forecast points or overrides change
  // Filter by active stint so each stint's overrides only shift its own predictions
  const chartData = buildChartData(forecastPoints, userOverrides, activeStintId);
  const hourlyCards = buildHourlyCards(forecastPoints);

  // Helper: find nearest chart data point by epoch
  const findNearestChartPoint = useCallback(
    (time: Date): ChartDataPoint | null => {
      if (chartData.length === 0) return null;
      const target = time.getTime();
      let best = chartData[0];
      let bestDiff = Math.abs(best.epoch - target);
      for (const p of chartData) {
        const diff = Math.abs(p.epoch - target);
        if (diff < bestDiff) {
          best = p;
          bestDiff = diff;
        }
      }
      return best;
    },
    [chartData]
  );

  // Current conditions: find nearest forecast point to "now"
  // Prefer user-offset-corrected values when available
  let currentConditions: UseWeatherForecastResult["currentConditions"] = null;
  if (forecastPoints.length > 0) {
    const now = new Date();
    let best = forecastPoints[0];
    let bestDiff = Math.abs(new Date(best.time).getTime() - now.getTime());
    for (const p of forecastPoints) {
      const diff = Math.abs(new Date(p.time).getTime() - now.getTime());
      if (diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }

    // Estimate asphalt from the nearest forecast point
    const asphalt = estimateAsphaltTemp(
      best.ambient,
      best.shortwaveRadiation,
      best.windSpeed,
      best.cloudCover
    );

    // Check if chart data has user-corrected values for this time
    const nearestChart = findNearestChartPoint(now);
    const ambient = nearestChart?.userAmbient ?? best.ambient;
    const asphaltVal = nearestChart?.userAsphalt ?? Math.round(asphalt * 10) / 10;

    currentConditions = {
      ambient,
      asphalt: asphaltVal,
      cloudCover: best.cloudCover,
      windSpeed: best.windSpeed,
      humidity: best.humidity,
    };
  }

  // Get forecast conditions at any time (nearest point)
  // Uses user-offset-corrected values when overrides are present,
  // otherwise raw API values.
  const getForecastAtTime = useCallback(
    (time: Date): { ambient: number; asphalt: number } | null => {
      if (forecastPoints.length === 0) return null;

      // Find nearest raw forecast point for fallback
      let best = forecastPoints[0];
      let bestDiff = Math.abs(new Date(best.time).getTime() - time.getTime());
      for (const p of forecastPoints) {
        const diff = Math.abs(new Date(p.time).getTime() - time.getTime());
        if (diff < bestDiff) {
          best = p;
          bestDiff = diff;
        }
      }
      const apiAsphalt = estimateAsphaltTemp(
        best.ambient,
        best.shortwaveRadiation,
        best.windSpeed,
        best.cloudCover
      );

      // Prefer user-corrected values from chart data
      const nearestChart = findNearestChartPoint(time);
      return {
        ambient: nearestChart?.userAmbient ?? Math.round(best.ambient * 10) / 10,
        asphalt: nearestChart?.userAsphalt ?? Math.round(apiAsphalt * 10) / 10,
      };
    },
    [forecastPoints, findNearestChartPoint]
  );

  return {
    forecastPoints,
    chartData,
    hourlyCards,
    currentConditions,
    getForecastAtTime,
    isLoading,
    error,
    refetch: doFetch,
  };
}
