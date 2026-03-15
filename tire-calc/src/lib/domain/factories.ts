import {
  type AppSettings,
  type Session,
  type SessionStartBaseline,
  type PitstopEntry,
  type TemperatureRun,
  type WeatherSnapshot,
  type TargetMode,
  type Targets,
  type WeatherSource,
  DEFAULT_APP_SETTINGS,
  SCHEMA_VERSION,
  APP_VERSION,
} from "./models";
import { generateId, nowISO } from "../utils/helpers";

// ─── Factory: Session ──────────────────────────────────────────────

export function createSession(
  overrides: Partial<Session> & Pick<Session, "name" | "trackName">
): Session {
  const now = nowISO();
  return {
    id: generateId(),
    date: now.slice(0, 10),
    location: "",
    notes: "",
    setupTags: [],
    compoundPreset: "",
    baseline: createSessionStartBaseline(),
    createdAt: now,
    updatedAt: now,
    pitstops: [],
    weatherSnapshots: [],
    temperatureRuns: [],
    recommendationHistory: [],
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    ...overrides,
  };
}

// ─── Factory: SessionStartBaseline ─────────────────────────────────

export function createSessionStartBaseline(
  overrides?: Partial<SessionStartBaseline>
): SessionStartBaseline {
  return {
    coldPressures: {},
    startTireTemps: {},
    ...overrides,
  };
}

// ─── Factory: PitstopEntry ─────────────────────────────────────────

export function createPitstopEntry(
  index: number,
  targetMode: TargetMode = "single",
  targets: Targets = {}
): PitstopEntry {
  return {
    id: generateId(),
    index,
    targetMode,
    targets,
  };
}

// ─── Factory: TemperatureRun ───────────────────────────────────────

export function createTemperatureRun(
  overrides?: Partial<TemperatureRun>
): TemperatureRun {
  return {
    id: generateId(),
    readings: {},
    timestamp: nowISO(),
    ...overrides,
  };
}

// ─── Factory: WeatherSnapshot ──────────────────────────────────────

export function createWeatherSnapshot(
  source: WeatherSource,
  overrides?: Partial<WeatherSnapshot>
): WeatherSnapshot {
  return {
    id: generateId(),
    timestamp: nowISO(),
    source,
    ...overrides,
  };
}

// ─── Factory: AppSettings (reset to defaults) ──────────────────────

export function createAppSettings(
  overrides?: Partial<AppSettings>
): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
  };
}
