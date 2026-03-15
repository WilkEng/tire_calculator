// ─── Demo / Seed Data ──────────────────────────────────────────────
//
// A realistic multi-pitstop session that demonstrates all features.
// This can be imported or auto-loaded for testing and demos.
// ────────────────────────────────────────────────────────────────────

import type { Session, PitstopEntry } from "@/lib/domain/models";
import { SCHEMA_VERSION, APP_VERSION } from "@/lib/domain/models";

export const DEMO_SESSION: Session = {
  id: "demo-session-spa-2026",
  name: "FP2 Spa Saturday",
  trackName: "Spa-Francorchamps",
  location: "Stavelot, Belgium",
  latitude: 50.4372,
  longitude: 5.9714,
  date: "2026-03-14",
  notes: "Dry, cloudy, mild conditions. Pirelli Medium compound.",
  setupTags: ["baseline", "low-downforce"],
  compoundPreset: "Pirelli Medium",
  createdAt: "2026-03-14T09:00:00Z",
  updatedAt: "2026-03-14T12:30:00Z",
  schemaVersion: SCHEMA_VERSION,
  appVersion: APP_VERSION,

  pitstops: [
    // ── Pitstop 1: First stint data ──
    {
      id: "demo-pit-1",
      index: 1,
      plannedStintStartTime: "2026-03-14T09:00:00Z",
      actualPitstopTime: "2026-03-14T09:25:00Z",
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      ambientMeasured: 18,
      asphaltMeasured: 28,
      ambientForecastAtStint: 17,
      asphaltForecastAtStint: 26,
      startTireTemps: { FL: 20, FR: 20, RL: 20, RR: 20 },
      coldStartPressures: { FL: 1.72, FR: 1.72, RL: 1.72, RR: 1.72 },
      hotMeasuredPressures: { FL: 1.88, FR: 1.87, RL: 1.86, RR: 1.85 },
      hotCorrectedPressures: undefined,
      notes: "Install run, very conservative cold pressure. Car came in slightly hot on fronts.",
    },
    // ── Pitstop 2: Second stint after adjustment ──
    {
      id: "demo-pit-2",
      index: 2,
      plannedStintStartTime: "2026-03-14T09:35:00Z",
      actualPitstopTime: "2026-03-14T10:00:00Z",
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      ambientMeasured: 20,
      asphaltMeasured: 33,
      ambientForecastAtStint: 20,
      asphaltForecastAtStint: 32,
      startTireTemps: { FL: 22, FR: 22, RL: 22, RR: 22 },
      coldStartPressures: { FL: 1.68, FR: 1.68, RL: 1.70, RR: 1.70 },
      hotMeasuredPressures: { FL: 1.86, FR: 1.85, RL: 1.85, RR: 1.84 },
      hotCorrectedPressures: { FL: 1.85, FR: 1.85, RL: 1.85, RR: 1.84 },
      notes: "Track warmed up. Bled fronts down to target. Good balance.",
    },
    // ── Pitstop 3: Warmer conditions ──
    {
      id: "demo-pit-3",
      index: 3,
      plannedStintStartTime: "2026-03-14T10:15:00Z",
      actualPitstopTime: "2026-03-14T10:45:00Z",
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      ambientMeasured: 22,
      asphaltMeasured: 40,
      ambientForecastAtStint: 23,
      asphaltForecastAtStint: 42,
      startTireTemps: { FL: 24, FR: 24, RL: 24, RR: 24 },
      coldStartPressures: { FL: 1.65, FR: 1.66, RL: 1.67, RR: 1.67 },
      hotMeasuredPressures: { FL: 1.85, FR: 1.85, RL: 1.86, RR: 1.85 },
      notes: "Nailed it. Fronts on target, rears slightly high. Track significantly warmer.",
    },
  ],

  weatherSnapshots: [
    {
      id: "demo-weather-1",
      timestamp: "2026-03-14T09:00:00Z",
      source: "open-meteo-forecast",
      ambient: 17,
      cloudCover: 70,
      windSpeed: 3.2,
      shortwaveRadiation: 180,
      humidity: 65,
    },
    {
      id: "demo-weather-2",
      timestamp: "2026-03-14T10:00:00Z",
      source: "open-meteo-forecast",
      ambient: 20,
      cloudCover: 50,
      windSpeed: 2.8,
      shortwaveRadiation: 350,
      humidity: 58,
    },
    {
      id: "demo-weather-3",
      timestamp: "2026-03-14T11:00:00Z",
      source: "open-meteo-forecast",
      ambient: 23,
      cloudCover: 30,
      windSpeed: 2.5,
      shortwaveRadiation: 520,
      humidity: 52,
    },
  ],

  temperatureRuns: [
    {
      id: "demo-temp-run-1",
      linkedPitstopId: "demo-pit-2",
      setupTag: "baseline",
      hotPressureGroup: "1.85 bar",
      readings: {
        FL: { inner: 92, middle: 88, outer: 85 },
        FR: { inner: 93, middle: 89, outer: 84 },
        RL: { inner: 88, middle: 86, outer: 84 },
        RR: { inner: 87, middle: 85, outer: 83 },
      },
      notes: "Post stint 2, slight inner wear on fronts.",
      timestamp: "2026-03-14T10:05:00Z",
    },
    {
      id: "demo-temp-run-2",
      linkedPitstopId: "demo-pit-3",
      setupTag: "baseline",
      hotPressureGroup: "1.85 bar",
      readings: {
        FL: { inner: 95, middle: 91, outer: 87 },
        FR: { inner: 96, middle: 92, outer: 86 },
        RL: { inner: 90, middle: 88, outer: 86 },
        RR: { inner: 89, middle: 87, outer: 85 },
      },
      notes: "Post stint 3, hotter track. Inner wear unchanged.",
      timestamp: "2026-03-14T10:50:00Z",
    },
  ],

  recommendationHistory: [],
};

/**
 * A second demo session at a different track for cross-session testing.
 */
export const DEMO_SESSION_MONZA: Session = {
  id: "demo-session-monza-2026",
  name: "FP1 Monza Friday",
  trackName: "Monza",
  location: "Monza, Italy",
  latitude: 45.6156,
  longitude: 9.2811,
  date: "2026-03-07",
  notes: "Hot day, clear skies.",
  setupTags: ["low-downforce"],
  compoundPreset: "Pirelli Hard",
  createdAt: "2026-03-07T10:00:00Z",
  updatedAt: "2026-03-07T13:00:00Z",
  schemaVersion: SCHEMA_VERSION,
  appVersion: APP_VERSION,

  pitstops: [
    {
      id: "demo-monza-pit-1",
      index: 1,
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.90 },
      ambientMeasured: 28,
      asphaltMeasured: 48,
      coldStartPressures: { FL: 1.68, FR: 1.68, RL: 1.68, RR: 1.68 },
      hotMeasuredPressures: { FL: 1.92, FR: 1.91, RL: 1.90, RR: 1.89 },
      notes: "Hot track, high pressures.",
    },
  ],

  weatherSnapshots: [],
  temperatureRuns: [],
  recommendationHistory: [],
};
