"use client";

import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ColdPressureCard } from "@/components/dashboard/ColdPressureCard";
import { TemperatureChart } from "@/components/dashboard/TemperatureChart";
import { HourlyForecastCard } from "@/components/dashboard/HourlyForecastCard";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import Link from "next/link";
import { useMemo } from "react";
import { computeRecommendation, type RecommendationInput } from "@/lib/engine";
import type { RecommendationOutput } from "@/lib/domain/models";

export default function DashboardPage() {
  const { session, settings } = useSessionContext();

  // Weather Forecast
  const weatherForecast = useWeatherForecast(
    session?.latitude,
    session?.longitude,
    session?.userWeatherOverrides
  );

  // Determine if user has overrides
  const hasUserAmbient = useMemo(
    () =>
      (session?.userWeatherOverrides ?? []).some(
        (o) => o.ambientOverride != null
      ),
    [session?.userWeatherOverrides]
  );

  const hasUserAsphalt = useMemo(
    () =>
      (session?.userWeatherOverrides ?? []).some(
        (o) => o.asphaltOverride != null
      ),
    [session?.userWeatherOverrides]
  );

  // Recommendation
  const recommendation: RecommendationOutput | null = useMemo(() => {
    if (!session || !session.stints || session.stints.length < 1) return null;
    const latestStint = session.stints[session.stints.length - 1];
    if (!latestStint.pitstops || latestStint.pitstops.length === 0) return null;
    const latestPitstop = latestStint.pitstops[latestStint.pitstops.length - 1];

    const ambient =
      weatherForecast.currentConditions?.ambient ??
      latestStint.baseline?.ambientMeasured ??
      20;
    const asphalt =
      weatherForecast.currentConditions?.asphalt ??
      latestStint.baseline?.asphaltMeasured ??
      30;

    const input: RecommendationInput = {
      currentSession: session,
      currentStintId: latestStint.id,
      currentPitstopId: latestPitstop.id,
      nextConditions: {
        ambientTemp: ambient,
        asphaltTemp: asphalt,
        startTireTemps: latestStint.baseline?.startTireTemps,
      },
      targetMode: latestStint.baseline?.targetMode ?? "single",
      targets: latestStint.baseline?.targets ?? {},
      priorSessions: [],
      settings,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [session, settings, weatherForecast.currentConditions]);

  // Conditions label for ColdPressureCard
  const conditionsLabel = useMemo(() => {
    if (!session) return undefined;
    const latestStint = session.stints?.[session.stints.length - 1];
    if (!latestStint) return undefined;

    const parts: string[] = [`Based on ${latestStint.name}`];
    if (weatherForecast.currentConditions) {
      parts.push(
        `-> ${weatherForecast.currentConditions.ambient.toFixed(1)} deg ${settings.unitsTemperature} amb / ${weatherForecast.currentConditions.asphalt.toFixed(1)} deg ${settings.unitsTemperature} asp`
      );
      if (hasUserAmbient || hasUserAsphalt) {
        parts.push("(user-corrected)");
      } else {
        parts.push("(API forecast)");
      }
    }
    return parts.join(" ");
  }, [session, weatherForecast.currentConditions, settings.unitsTemperature, hasUserAmbient, hasUserAsphalt]);

  const latestStint = session?.stints?.[session.stints.length - 1];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>

      {!session ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <p className="text-gray-400 text-center max-w-md">
            No active session. Create one from the Planner or load from History.
          </p>
          <div className="flex gap-3">
            <Link href="/planner">
              <Button>+ New Session</Button>
            </Link>
            <Link href="/history">
              <Button variant="secondary">Load from History</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cold Pressure Recommendation */}
          <ColdPressureCard
            recommendation={recommendation}
            pressureUnit={settings.unitsPressure}
            conditionsLabel={conditionsLabel}
          />

          {/* Temperature Chart */}
          <Card title="Temperature Forecast">
            {weatherForecast.isLoading ? (
              <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                Loading weather data...
              </div>
            ) : weatherForecast.error ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <p className="text-red-400 text-sm">
                  Weather error: {weatherForecast.error}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={weatherForecast.refetch}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <TemperatureChart
                data={weatherForecast.chartData}
                temperatureUnit={settings.unitsTemperature}
                hasUserAmbient={hasUserAmbient}
                hasUserAsphalt={hasUserAsphalt}
              />
            )}
          </Card>

          {/* Hourly Forecast */}
          <Card title="Hourly Forecast">
            {weatherForecast.isLoading ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Loading...
              </p>
            ) : (
              <HourlyForecastCard
                cards={weatherForecast.hourlyCards}
                temperatureUnit={settings.unitsTemperature}
              />
            )}
          </Card>

          {/* Session Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card title="Current Conditions">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Ambient</div>
                  <div className="text-2xl font-bold text-gray-200 tabular-nums">
                    {weatherForecast.currentConditions?.ambient?.toFixed(1) ??
                      latestStint?.baseline?.ambientMeasured?.toFixed(1) ??
                      "\u2014"}
                    <span className="text-sm text-gray-500 ml-1">
                      {"\u00B0"}{settings.unitsTemperature}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Asphalt</div>
                  <div className="text-2xl font-bold text-gray-200 tabular-nums">
                    {weatherForecast.currentConditions?.asphalt?.toFixed(1) ??
                      latestStint?.baseline?.asphaltMeasured?.toFixed(1) ??
                      "\u2014"}
                    <span className="text-sm text-gray-500 ml-1">
                      {"\u00B0"}{settings.unitsTemperature}
                    </span>
                  </div>
                </div>
              </div>
              {weatherForecast.currentConditions && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 flex gap-4 text-xs text-gray-500">
                  <span>
                    Cloud: {weatherForecast.currentConditions.cloudCover}%
                  </span>
                  <span>
                    Wind: {weatherForecast.currentConditions.windSpeed?.toFixed(1)} m/s
                  </span>
                  <span>
                    Humidity: {weatherForecast.currentConditions.humidity}%
                  </span>
                </div>
              )}
            </Card>

            <Card title="Session Status">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Session</span>
                  <span className="text-gray-200 font-medium">
                    {session.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Track</span>
                  <span className="text-gray-200 font-medium">
                    {session.trackName || "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span className="text-gray-200 font-medium">
                    {session.date
                      ? new Date(session.date).toLocaleDateString()
                      : "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stints</span>
                  <span className="text-gray-200 font-medium">
                    {session.stints?.length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Pitstops</span>
                  <span className="text-gray-200 font-medium">
                    {session.stints?.reduce(
                      (acc, s) => acc + s.pitstops.length,
                      0
                    ) || 0}
                  </span>
                </div>
                {session.compoundPreset && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Compound</span>
                    <span className="text-gray-200 font-medium">
                      {session.compoundPreset}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end">
                <Link href="/planner">
                  <Button variant="secondary" size="sm">
                    Go to Planner {"\u2192"}
                  </Button>
                </Link>
              </div>
            </Card>

            <Card title="Location">
              <div className="space-y-2 text-sm">
                {session.location ? (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location</span>
                    <span className="text-gray-200 font-medium">
                      {session.location}
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-500">No location set.</p>
                )}
                {session.latitude != null && session.longitude != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coordinates</span>
                    <span className="text-gray-200 font-medium tabular-nums">
                      {session.latitude.toFixed(4)},{" "}
                      {session.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
              {!session.latitude && (
                <p className="text-xs text-gray-500 mt-2">
                  Set a location in the Planner to enable weather forecasts.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
