// ─── Tire Calc Domain Models ───────────────────────────────────────
// All domain types live here. Every persisted entity includes
// schemaVersion, appVersion, timestamps, and a stable id.

export const SCHEMA_VERSION = 2;
export const APP_VERSION = "0.2.0";

// ─── Enums / Literal Unions ────────────────────────────────────────

/** Pressure unit preference */
export type PressureUnit = "bar" | "psi" | "kPa";

/** Temperature unit preference */
export type TemperatureUnit = "C" | "F";

/** How targets are specified */
export type TargetMode = "single" | "front-rear" | "four-corner";

/** Canonical corner identifiers */
export type Corner = "FL" | "FR" | "RL" | "RR";

/** Where a weather data point came from */
export type WeatherSource = "open-meteo-forecast" | "open-meteo-history" | "manual";

/** Where the reference for a recommendation came from */
export type ReferenceSource =
  | "same-session-similar"
  | "same-session-nearest"
  | "prior-session-same-track-same-mode"
  | "prior-session-same-track"
  | "classic-mode-fallback";

// ─── Small Value Objects ───────────────────────────────────────────

/** Per-corner numeric values (pressures, temps, etc.) */
export interface CornerValues {
  FL: number;
  FR: number;
  RL: number;
  RR: number;
}

/** Optional per-corner values (some corners may not be entered) */
export type PartialCornerValues = Partial<CornerValues>;

/** Hot-pressure targets – only the fields relevant to the active TargetMode are required */
export interface Targets {
  /** Used when targetMode === "single" */
  singleTargetHotPressure?: number;
  /** Used when targetMode === "front-rear" */
  frontTargetHotPressure?: number;
  /** Used when targetMode === "front-rear" */
  rearTargetHotPressure?: number;
  /** Used when targetMode === "four-corner" */
  cornerTargets?: CornerValues;
}

/** Probe / pyrometer reading for one corner */
export interface CornerTemperatureReading {
  inner: number;
  middle: number;
  outer: number;
}

/** All four corners of probe temp readings */
export interface FourCornerTemperatureReadings {
  FL: CornerTemperatureReading;
  FR: CornerTemperatureReading;
  RL: CornerTemperatureReading;
  RR: CornerTemperatureReading;
}

// ─── Recommendation Output ─────────────────────────────────────────

export interface CoefficientsUsed {
  kTemp: number;
  kTrack: number;
  kAmbient: number;
}

export interface RecommendationOutput {
  /** Recommended cold start pressures for next stint */
  recommendedColdPressures: CornerValues;
  /** Predicted hot pressures if recommendation is followed */
  predictedHotPressures: CornerValues;
  /** Delta of predicted hot vs target for each corner */
  deltasToTarget: CornerValues;
  /** Human-readable rationale */
  rationaleText: string;
  /** 0–1 confidence in the recommendation */
  confidenceScore: number;
  /** Which reference was used */
  referenceSource: ReferenceSource;
  /** Coefficients that were applied */
  coefficientsUsed: CoefficientsUsed;
}

// ─── Stint Baseline ────────────────────────────────────────────────
//
// The starting conditions BEFORE a stint.
// Target hot pressures, Cold pressures, and Weather live here.

export interface StintBaseline {
  /** Cold pressures set before the stint */
  coldPressures?: PartialCornerValues;
  /** Optional starting tire temperatures */
  startTireTemps?: PartialCornerValues;
  
  /** How the targets are specified for this stint */
  targetMode: TargetMode;
  /** Target hot pressure values */
  targets: Targets;

  /** Optional measured/forecast ambient temperature at stint start */
  ambientMeasured?: number;
  /** Optional measured/forecast asphalt/track temperature at stint start */
  asphaltMeasured?: number;
}

// ─── Pitstop Entry ─────────────────────────────────────────────────
//
// Pitstops record data from when the car comes in.
// Targets, Weather, and Cold pressures are NO LONGER stored here.

export interface PitstopEntry {
  id: string;
  /** 1-based index within the stint */
  index: number;

  /** When the stint before this pitstop was planned to start */
  plannedStintStartTime?: string; // ISO 8601
  /** When the car actually came in */
  actualPitstopTime?: string; // ISO 8601

  // ── Pressures (pitstop-only data) ──
  /** Hot pressures as measured when the car comes in */
  hotMeasuredPressures?: PartialCornerValues;
  /**
   * Bled / corrected hot pressures.
   * Defaults to hotMeasuredPressures when undefined.
   * Only stores explicit user overrides.
   */
  hotCorrectedPressures?: PartialCornerValues;
  /**
   * Tracks which bled/corrected corners were manually edited.
   * When true for a corner, that bled value won't auto-follow hot changes.
   */
  bledLocked?: Partial<Record<Corner, boolean>>;

  /** Optional hot tire temperatures from pyrometer when car comes in */
  hotTireTemps?: PartialCornerValues;

  /** Freeform notes */
  notes?: string;

  /** Engine output for this pitstop (predicting next stint) */
  recommendationOutput?: RecommendationOutput;
}

// ─── Stint ─────────────────────────────────────────────────────────

export interface Stint {
  id: string;
  name: string; // e.g. 'FP1', 'Q1', 'Race'
  
  /** The starting conditions and targets for this stint */
  baseline: StintBaseline;

  /** The pitstops that occurred during this stint */
  pitstops: PitstopEntry[];
}

// ─── Temperature Run ───────────────────────────────────────────────

export interface TemperatureRun {
  id: string;
  /** Link back to a pitstop */
  linkedPitstopId?: string;
  /** Optional setup tag for grouping */
  setupTag?: string;
  /** Hot pressure group label for averaging */
  hotPressureGroup?: string;

  /** Readings per corner */
  readings: Partial<FourCornerTemperatureReadings>;

  /** Computed averages per corner */
  averages?: PartialCornerValues;

  notes?: string;
  timestamp: string; // ISO 8601
}

// ─── Weather Snapshot ──────────────────────────────────────────────

export interface WeatherSnapshot {
  id: string;
  timestamp: string; // ISO 8601
  source: WeatherSource;

  ambient?: number;
  cloudCover?: number;      // percent 0–100
  windSpeed?: number;       // m/s
  shortwaveRadiation?: number; // W/m²
  humidity?: number;        // percent 0–100
}

// ─── Session ───────────────────────────────────────────────────────

export interface Session {
  id: string;
  name: string;
  trackName: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  date: string; // ISO 8601 date

  notes?: string;
  setupTags?: string[];
  compoundPreset?: string;

  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601

  /** Each session consists of multiple stints (e.g., FP1, Quali). */
  stints: Stint[];

  weatherSnapshots: WeatherSnapshot[];
  temperatureRuns: TemperatureRun[];
  recommendationHistory: RecommendationOutput[];

  schemaVersion: number;
  appVersion: string;
}

// ─── App Settings ──────────────────────────────────────────────────

export interface AppSettings {
  unitsPressure: PressureUnit;
  unitsTemperature: TemperatureUnit;

  /** Default starting tire temperature when none is measured */
  defaultStartTireTemp: number;
  /** Default target mode for new sessions */
  defaultTargetMode: TargetMode;

  /** Whether session-to-session carry-over is active */
  carryOverEnabled: boolean;
  /** Weather provider key */
  weatherProvider: "open-meteo";

  /** Classic Wilkinson mode enabled */
  classicModeEnabled: boolean;
  /** Advanced settings visible */
  advancedModeEnabled: boolean;

  // ── Classic-mode coefficients (editable in advanced settings) ──
  /** Pressure sensitivity: bar/°C */
  kTemp: number;
  /** Asphalt weighting multiplier */
  kTrack: number;
  /** Ambient weighting multiplier */
  kAmbient: number;

  schemaVersion: number;
  appVersion: string;
}

// ─── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS: AppSettings = {
  unitsPressure: "bar",
  unitsTemperature: "C",
  defaultStartTireTemp: 25,
  defaultTargetMode: "single",
  carryOverEnabled: true,
  weatherProvider: "open-meteo",
  classicModeEnabled: true,
  advancedModeEnabled: false,
  kTemp: 0.012,
  kTrack: 1.75,
  kAmbient: 1.0,
  schemaVersion: SCHEMA_VERSION,
  appVersion: APP_VERSION,
};
