// ─── Tire Calc Domain Models ───────────────────────────────────────
// All domain types live here. Every persisted entity includes
// schemaVersion, appVersion, timestamps, and a stable id.

export const SCHEMA_VERSION = 3;
export const APP_VERSION = "0.3.0";

// ─── Enums / Literal Unions ────────────────────────────────────────

/** Pressure unit preference */
export type PressureUnit = "bar" | "psi" | "kPa";

/** Temperature unit preference */
export type TemperatureUnit = "C" | "F";

/** How targets are specified */
export type TargetMode = "single" | "front-rear" | "four-corner";

/** Canonical corner identifiers */
export type Corner = "FL" | "FR" | "RL" | "RR";

/** Built-in tire compound types */
export type CompoundType = "soft" | "medium" | "hard" | "wet";

/** All built-in compound keys */
export const BUILT_IN_COMPOUNDS: CompoundType[] = ["soft", "medium", "hard", "wet"];

/** Type guard for built-in compound keys */
export function isBuiltInCompound(s: string): s is CompoundType {
  return BUILT_IN_COMPOUNDS.includes(s as CompoundType);
}

/** User-defined custom tire compound */
export interface CustomCompound {
  id: string;
  name: string;
  kAmbient: number;
  kTrack: number;
  minColdPressureBar: number;
}

/** Per-compound coefficient presets */
export interface CompoundCoefficients {
  kAmbient: number;
  kTrack: number;
  /** Minimum cold pressure warning threshold for this compound (bar) */
  minColdPressureBar: number;
}

export const COMPOUND_PRESETS: Record<CompoundType, CompoundCoefficients> = {
  soft:   { kAmbient: 1.10, kTrack: 1.90, minColdPressureBar: 1.3 },
  medium: { kAmbient: 1.00, kTrack: 1.75, minColdPressureBar: 1.3 },
  hard:   { kAmbient: 0.90, kTrack: 1.55, minColdPressureBar: 1.3 },
  wet:    { kAmbient: 0.95, kTrack: 0.70, minColdPressureBar: 1.2 },
};

/** Where a weather data point came from */
export type WeatherSource = "open-meteo-forecast" | "open-meteo-history" | "manual";

/** Where the reference for a recommendation came from */
export type ReferenceSource =
  | "same-event-similar"
  | "same-event-nearest"
  | "prior-event-same-track-same-mode"
  | "prior-event-same-track"
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

  /** Tire compound key for this stint (built-in name or custom compound ID) */
  compound?: string;

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

  /** Pyrometer / probe readings (inner/middle/outer per corner) */
  temperatureReadings?: Partial<FourCornerTemperatureReadings>;

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

  /** If the baseline was imported from a file or another event */
  importedBaseline?: {
    sourceEventName?: string;
    sourceStintName?: string;
    importedAt: string; // ISO 8601
  };

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

// ─── User Weather Override ──────────────────────────────────────────
//
// Records a user-entered ambient or asphalt measurement at a specific time.
// Used to build offset-corrected forecast lines on the dashboard chart.

export interface UserWeatherOverride {
  id: string;
  timestamp: string; // ISO 8601 — when the measurement was taken/entered
  ambientOverride?: number;  // user-measured ambient temp
  asphaltOverride?: number;  // user-measured asphalt temp
  stintId?: string;          // which stint this override belongs to
}

// ─── Event ───────────────────────────────────────────────────────

export interface Event {
  id: string;
  name: string;
  trackName: string;
  vehicle?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  date: string; // ISO 8601 date

  notes?: string;
  setupTags?: string[];
  compoundPreset?: string;

  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601

  /** Each event consists of multiple stints (e.g., FP1, Quali). */
  stints: Stint[];

  /** User-entered ambient/asphalt overrides throughout the day */
  userWeatherOverrides: UserWeatherOverride[];

  weatherSnapshots: WeatherSnapshot[];
  temperatureRuns: TemperatureRun[];
  recommendationHistory: RecommendationOutput[];

  schemaVersion: number;
  appVersion: string;
}

/** @deprecated Use Event instead */
export type Session = Event;

// ─── App Settings ──────────────────────────────────────────────────

export interface AppSettings {
  unitsPressure: PressureUnit;
  unitsTemperature: TemperatureUnit;

  /** Default starting tire temperature when none is measured */
  defaultStartTireTemp: number;
  /** Default target mode for new events */
  defaultTargetMode: TargetMode;
  /** Default compound for new stints (built-in name or custom compound ID) */
  defaultCompound: string;

  /** Whether event-to-event carry-over is active */
  carryOverEnabled: boolean;
  /** Weather provider key */
  weatherProvider: "open-meteo";

  // ── Pressure sensitivity coefficient ──
  /** Pressure sensitivity: bar/°C */
  kTemp: number;

  /** User-adjustable per-compound coefficient overrides */
  compoundCoefficients: Record<CompoundType, CompoundCoefficients>;

  /** User-defined custom compounds */
  customCompounds: CustomCompound[];

  /** Temperature spread threshold for camber assessment (°C) */
  camberSpreadThreshold: number;

  schemaVersion: number;
  appVersion: string;
}

// ─── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS: AppSettings = {
  unitsPressure: "bar",
  unitsTemperature: "C",
  defaultStartTireTemp: 25,
  defaultTargetMode: "single",
  defaultCompound: "medium",
  carryOverEnabled: true,
  weatherProvider: "open-meteo",
  kTemp: 0.0105,
  compoundCoefficients: { ...COMPOUND_PRESETS },
  customCompounds: [],
  camberSpreadThreshold: 12,
  schemaVersion: SCHEMA_VERSION,
  appVersion: APP_VERSION,
};
