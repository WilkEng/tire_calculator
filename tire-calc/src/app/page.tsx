"use client";

import { useEventContext } from "@/context/EventContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ColdPressurePanel } from "@/components/shared/ColdPressurePanel";
import { TemperatureChart } from "@/components/dashboard/TemperatureChart";
import { HourlyForecastCard } from "@/components/dashboard/HourlyForecastCard";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import Link from "next/link";
import { useMemo } from "react";
import { computeRecommendation, resolveMinColdPressure, type RecommendationInput } from "@/lib/engine";
import type { RecommendationOutput } from "@/lib/domain/models";

export default function DashboardPage() {
  const { event, settings } = useEventContext();

  // Weather Forecast
  const weatherForecast = useWeatherForecast(
    event?.latitude,
    event?.longitude,
    event?.userWeatherOverrides
  );

  // Determine if user has overrides
  const hasUserAmbient = useMemo(
    () =>
      (event?.userWeatherOverrides ?? []).some(
        (o) => o.ambientOverride != null
      ),
    [event?.userWeatherOverrides]
  );

  const hasUserAsphalt = useMemo(
    () =>
      (event?.userWeatherOverrides ?? []).some(
        (o) => o.asphaltOverride != null
      ),
    [event?.userWeatherOverrides]
  );

  // Latest user-measured overrides
  const latestAmbientMeasured = useMemo(() => {
    const overrides = (event?.userWeatherOverrides ?? [])
      .filter((o) => o.ambientOverride != null)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    return overrides[0]?.ambientOverride;
  }, [event?.userWeatherOverrides]);

  const latestAsphaltMeasured = useMemo(() => {
    const overrides = (event?.userWeatherOverrides ?? [])
      .filter((o) => o.asphaltOverride != null)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    return overrides[0]?.asphaltOverride;
  }, [event?.userWeatherOverrides]);

  // Recommendation
  const recommendation: RecommendationOutput | null = useMemo(() => {
    if (!event || !event.stints || event.stints.length < 1) return null;
    const latestStint = event.stints[event.stints.length - 1];
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
      currentEvent: event,
      currentStintId: latestStint.id,
      currentPitstopId: latestPitstop.id,
      nextConditions: {
        ambientTemp: ambient,
        asphaltTemp: asphalt,
        startTireTemps: latestStint.baseline?.startTireTemps,
      },
      targetMode: latestStint.baseline?.targetMode ?? "single",
      targets: latestStint.baseline?.targets ?? {},
      priorEvents: [],
      settings,
      compound: latestStint.baseline?.compound,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [event, settings, weatherForecast.currentConditions]);

  // Conditions label
  const conditionsLabel = useMemo(() => {
    if (!event) return undefined;
    const latestStint = event.stints?.[event.stints.length - 1];
    if (!latestStint) return undefined;

    const parts: string[] = [`Based on ${latestStint.name}`];
    if (weatherForecast.currentConditions) {
      parts.push(
        `\u2192 ${weatherForecast.currentConditions.ambient.toFixed(1)}\u00B0${settings.unitsTemperature} amb / ${weatherForecast.currentConditions.asphalt.toFixed(1)}\u00B0${settings.unitsTemperature} asp`
      );
      if (hasUserAmbient || hasUserAsphalt) {
        parts.push("(user-corrected)");
      } else {
        parts.push("(API forecast)");
      }
    }
    return parts.join(" ");
  }, [event, weatherForecast.currentConditions, settings.unitsTemperature, hasUserAmbient, hasUserAsphalt]);

  const latestStint = event?.stints?.[event.stints.length - 1];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>

      {!event ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <p className="text-gray-400 text-center max-w-md">
            No active event. Create one from the Planner or load from History.
          </p>
          <div className="flex gap-3">
            <Link href="/planner">
              <Button>+ New Event</Button>
            </Link>
            <Link href="/history">
              <Button variant="secondary">Load from History</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unified Cold Pressure Recommendation + Calculator */}
          <ColdPressurePanel
            recommendation={recommendation}
            pressureUnit={settings.unitsPressure}
            temperatureUnit={settings.unitsTemperature}
            conditionsLabel={conditionsLabel}
            minColdPressureBar={resolveMinColdPressure(event.stints?.[event.stints.length - 1]?.baseline?.compound, settings)}
            collapsible={true}
            defaultCollapsed={true}
            event={event}
            settings={settings}
            currentConditions={weatherForecast.currentConditions}
            getForecastAtTime={weatherForecast.getForecastAtTime}
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

          {/* Event Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card title="Current Conditions">
              {weatherForecast.currentConditions ? (
                <div className="space-y-3">
                  {/* API Forecast row */}
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 font-medium">
                      API Forecast
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Ambient</div>
                        <div className="text-xl font-bold text-gray-300 tabular-nums">
                          {weatherForecast.currentConditions.ambient.toFixed(1)}
                          <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Asphalt</div>
                        <div className="text-xl font-bold text-gray-300 tabular-nums">
                          {weatherForecast.currentConditions.asphalt.toFixed(1)}
                          <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Corrected row (if user overrides exist) */}
                  {(hasUserAmbient || hasUserAsphalt) && (
                    <div className="pt-3 border-t border-gray-700/40">
                      <div className="text-[10px] text-teal-400 uppercase tracking-wide mb-1 font-medium">
                        Your Measurement
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Ambient</div>
                          <div className="text-2xl font-bold text-teal-400 tabular-nums">
                            {latestAmbientMeasured?.toFixed(1) ??
                              weatherForecast.currentConditions.ambient.toFixed(1)}
                            <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Asphalt</div>
                          <div className="text-2xl font-bold text-teal-400 tabular-nums">
                            {latestAsphaltMeasured?.toFixed(1) ??
                              weatherForecast.currentConditions.asphalt.toFixed(1)}
                            <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Weather metadata */}
                  <div className="pt-3 border-t border-gray-700/40 flex gap-4 text-xs text-gray-500">
                    <span>Cloud: {weatherForecast.currentConditions.cloudCover}%</span>
                    <span>Wind: {weatherForecast.currentConditions.windSpeed?.toFixed(1)} m/s</span>
                    <span>Humidity: {weatherForecast.currentConditions.humidity}%</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Ambient</div>
                    <div className="text-2xl font-bold text-gray-200 tabular-nums">
                      {latestStint?.baseline?.ambientMeasured?.toFixed(1) ?? "\u2014"}
                      <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Asphalt</div>
                    <div className="text-2xl font-bold text-gray-200 tabular-nums">
                      {latestStint?.baseline?.asphaltMeasured?.toFixed(1) ?? "\u2014"}
                      <span className="text-sm text-gray-500 ml-1">{"\u00B0"}{settings.unitsTemperature}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Event Status">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Event</span>
                  <span className="text-gray-200 font-medium">
                    {event.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Track</span>
                  <span className="text-gray-200 font-medium">
                    {event.trackName || "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Date</span>
                  <span className="text-gray-200 font-medium">
                    {event.date
                      ? new Date(event.date).toLocaleDateString()
                      : "\u2014"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stints</span>
                  <span className="text-gray-200 font-medium">
                    {event.stints?.length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Pitstops</span>
                  <span className="text-gray-200 font-medium">
                    {event.stints?.reduce(
                      (acc, s) => acc + s.pitstops.length,
                      0
                    ) || 0}
                  </span>
                </div>
                {event.compoundPreset && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Compound</span>
                    <span className="text-gray-200 font-medium">
                      {event.compoundPreset}
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
                {event.location ? (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location</span>
                    <span className="text-gray-200 font-medium">
                      {event.location}
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-500">No location set.</p>
                )}
                {event.latitude != null && event.longitude != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coordinates</span>
                    <span className="text-gray-200 font-medium tabular-nums">
                      {event.latitude.toFixed(4)},{" "}
                      {event.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
              {!event.latitude && (
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
