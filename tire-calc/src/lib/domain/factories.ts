import {
  type AppSettings,
  type Session,
  type Stint,
  type StintBaseline,
  type PitstopEntry,
  type TemperatureRun,
  type WeatherSnapshot,
  type UserWeatherOverride,
  type TargetMode,
  type Targets,
  type WeatherSource,
  type CompoundType,
  DEFAULT_APP_SETTINGS,
  SCHEMA_VERSION,
  APP_VERSION,
} from "./models";
import { generateId, nowISO } from "../utils/helpers";

// --- Factory: Session ----------------------------------------------
export function createSession(
  overrides: Partial<Session> & Pick<Session, "name" | "trackName">
): Session {
  const now = nowISO();
  return {
    id: generateId(),
    date: now.slice(0, 10),
    vehicle: "",
    location: "",
    notes: "",
    setupTags: [],
    compoundPreset: "",
    createdAt: now,
    updatedAt: now,
    stints: [],
    userWeatherOverrides: [],
    weatherSnapshots: [],
    temperatureRuns: [],
    recommendationHistory: [],
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    ...overrides,
  };
}

// --- Factory: Stint ------------------------------------------------
export function createStint(
  name: string,
  targetMode: TargetMode = "single",
  targets: Targets = {},
  compound?: CompoundType
): Stint {
  return {
    id: generateId(),
    name,
    baseline: createStintBaseline(targetMode, targets, compound ? { compound } : undefined),
    pitstops: [],
  };
}

// --- Factory: StintBaseline ----------------------------------------
export function createStintBaseline(
  targetMode: TargetMode = "single",
  targets: Targets = {},
  overrides?: Partial<StintBaseline>
): StintBaseline {
  return {
    coldPressures: {},
    startTireTemps: {},
    targetMode,
    targets,
    ...overrides,
  };
}

// --- Factory: PitstopEntry -----------------------------------------
export function createPitstopEntry(
  index: number
): PitstopEntry {
  return {
    id: generateId(),
    index,
  };
}

// --- Factory: TemperatureRun ---------------------------------------
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

// --- Factory: WeatherSnapshot --------------------------------------
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

// --- Factory: UserWeatherOverride -----------------------------------
export function createUserWeatherOverride(
  overrides: Omit<UserWeatherOverride, "id"> & Partial<Pick<UserWeatherOverride, "id">>
): UserWeatherOverride {
  return {
    id: generateId(),
    ...overrides,
  };
}

// --- Factory: AppSettings (reset to defaults) ----------------------
export function createAppSettings(
  overrides?: Partial<AppSettings>
): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
  };
}
