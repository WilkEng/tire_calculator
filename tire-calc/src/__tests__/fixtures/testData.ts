// ─── Demo / fixture data for engine tests ──────────────────────────

import type { Session, PitstopEntry, AppSettings } from "@/lib/domain/models";
import { DEFAULT_APP_SETTINGS, SCHEMA_VERSION, APP_VERSION } from "@/lib/domain/models";

/** A pitstop with full data for single target mode */
export function makeReferencePitstop(overrides?: Partial<PitstopEntry>): PitstopEntry {
  return {
    id: "pit-1",
    index: 1,
    targetMode: "single",
    targets: { singleTargetHotPressure: 1.85 },
    ambientMeasured: 22,
    asphaltMeasured: 38,
    coldStartPressures: { FL: 1.70, FR: 1.70, RL: 1.70, RR: 1.70 },
    hotMeasuredPressures: { FL: 1.87, FR: 1.86, RL: 1.84, RR: 1.85 },
    hotCorrectedPressures: undefined,
    startTireTemps: { FL: 25, FR: 25, RL: 25, RR: 25 },
    ...overrides,
  };
}

/** A pitstop that is the "next" one needing a recommendation */
export function makeNextPitstop(overrides?: Partial<PitstopEntry>): PitstopEntry {
  return {
    id: "pit-2",
    index: 2,
    targetMode: "single",
    targets: { singleTargetHotPressure: 1.85 },
    ambientMeasured: 24,
    asphaltMeasured: 42,
    ...overrides,
  };
}

/** A minimal session with one reference pitstop */
export function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-1",
    name: "FP1 Test",
    trackName: "Spa",
    date: "2026-03-14",
    createdAt: "2026-03-14T08:00:00Z",
    updatedAt: "2026-03-14T10:00:00Z",
    pitstops: [makeReferencePitstop()],
    weatherSnapshots: [],
    temperatureRuns: [],
    recommendationHistory: [],
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    ...overrides,
  };
}

/** A front-rear pitstop */
export function makeFrontRearPitstop(): PitstopEntry {
  return {
    id: "pit-fr-1",
    index: 1,
    targetMode: "front-rear",
    targets: { frontTargetHotPressure: 1.85, rearTargetHotPressure: 1.80 },
    ambientMeasured: 22,
    asphaltMeasured: 38,
    coldStartPressures: { FL: 1.70, FR: 1.70, RL: 1.65, RR: 1.65 },
    hotMeasuredPressures: { FL: 1.87, FR: 1.86, RL: 1.82, RR: 1.81 },
    startTireTemps: { FL: 25, FR: 25, RL: 25, RR: 25 },
  };
}

/** A four-corner pitstop */
export function makeFourCornerPitstop(): PitstopEntry {
  return {
    id: "pit-4c-1",
    index: 1,
    targetMode: "four-corner",
    targets: {
      cornerTargets: { FL: 1.85, FR: 1.83, RL: 1.80, RR: 1.78 },
    },
    ambientMeasured: 22,
    asphaltMeasured: 38,
    coldStartPressures: { FL: 1.70, FR: 1.68, RL: 1.65, RR: 1.63 },
    hotMeasuredPressures: { FL: 1.87, FR: 1.85, RL: 1.82, RR: 1.80 },
    startTireTemps: { FL: 25, FR: 25, RL: 25, RR: 25 },
  };
}

/** Default settings for tests */
export const TEST_SETTINGS: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
};
