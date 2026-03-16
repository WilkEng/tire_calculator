import { describe, it, expect } from "vitest";
import {
  getEffectiveColdForReference,
  selectReference,
  computeRecommendation,
  getColdForStint,
  getEffectiveBledPressures,
  expandTargets,
  computeFeedbackCorrection,
} from "./pressureEngine";
import type {
  Stint,
  PitstopEntry,
  Event,
  AppSettings,
  PartialCornerValues,
} from "@/lib/domain/models";
import { DEFAULT_APP_SETTINGS } from "@/lib/domain/models";

// ─── Helpers to build test fixtures ─────────────────────────────────

function makePitstop(
  id: string,
  index: number,
  hot: PartialCornerValues,
  bled?: PartialCornerValues
): PitstopEntry {
  return {
    id,
    index,
    hotMeasuredPressures: hot,
    hotCorrectedPressures: bled,
  };
}

function makeStint(
  id: string,
  name: string,
  coldPressures: PartialCornerValues,
  pitstops: PitstopEntry[],
  opts?: {
    targetMode?: "single" | "front-rear" | "four-corner";
    singleTarget?: number;
    ambient?: number;
    asphalt?: number;
    startTireTemps?: PartialCornerValues;
    compound?: string;
  }
): Stint {
  return {
    id,
    name,
    baseline: {
      coldPressures,
      targetMode: opts?.targetMode ?? "single",
      targets: { singleTargetHotPressure: opts?.singleTarget ?? 1.95 },
      ambientMeasured: opts?.ambient ?? 25,
      asphaltMeasured: opts?.asphalt ?? 30,
      startTireTemps: opts?.startTireTemps,
      compound: opts?.compound ?? "medium",
    },
    pitstops,
  };
}

function makeEvent(stints: Stint[], trackName = "TestTrack"): Event {
  const now = new Date().toISOString();
  return {
    id: "evt-1",
    name: "Test Event",
    trackName,
    date: now,
    createdAt: now,
    updatedAt: now,
    stints,
    userWeatherOverrides: [],
    weatherSnapshots: [],
    temperatureRuns: [],
    recommendationHistory: [],
    schemaVersion: 1,
    appVersion: "1.0.0",
  };
}

// ─── getEffectiveColdForReference ───────────────────────────────────

describe("getEffectiveColdForReference", () => {
  it("returns baseline cold when reference is the first pitstop (no prior bleeds)", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop("p1", 1, { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 });
    const stint = makeStint("s1", "FP1", cold, [p1]);

    const result = getEffectiveColdForReference(stint, "p1");
    expect(result).toEqual(cold);
  });

  it("adjusts cold by bleed at pitstop 1 when reference is pitstop 2", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }   // bled from 2.1 to 1.95
    );
    const p2 = makePitstop("p2", 2, { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 });
    const stint = makeStint("s1", "FP1", cold, [p1, p2]);

    const result = getEffectiveColdForReference(stint, "p2");
    // 1.3 + (1.95 - 2.10) = 1.3 - 0.15 = 1.15
    expect(result.FL).toBeCloseTo(1.15, 4);
    expect(result.FR).toBeCloseTo(1.15, 4);
    expect(result.RL).toBeCloseTo(1.15, 4);
    expect(result.RR).toBeCloseTo(1.15, 4);
  });

  it("accumulates bleeds from multiple prior pitstops", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }   // bled −0.15
    );
    const p2 = makePitstop(
      "p2", 2,
      { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }   // bled −0.04
    );
    const p3 = makePitstop("p3", 3, { FL: 1.96, FR: 1.96, RL: 1.96, RR: 1.96 });
    const stint = makeStint("s1", "FP1", cold, [p1, p2, p3]);

    const result = getEffectiveColdForReference(stint, "p3");
    // 1.3 + (−0.15) + (−0.04) = 1.11
    expect(result.FL).toBeCloseTo(1.11, 4);
  });

  it("makes no adjustment when no bleeding occurred", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    // No hotCorrectedPressures → bled defaults to hot measured → delta is 0
    const p1 = makePitstop("p1", 1, { FL: 1.9, FR: 1.9, RL: 1.9, RR: 1.9 });
    const p2 = makePitstop("p2", 2, { FL: 1.92, FR: 1.92, RL: 1.92, RR: 1.92 });
    const stint = makeStint("s1", "FP1", cold, [p1, p2]);

    const result = getEffectiveColdForReference(stint, "p2");
    expect(result).toEqual(cold);
  });

  it("handles per-corner independent adjustments", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.0, RL: 1.9, RR: 2.05 },
      { FL: 1.95, FR: 2.0, RL: 1.9, RR: 1.95 }  // FL bled −0.15, FR no bleed, RL no bleed, RR bled −0.10
    );
    const p2 = makePitstop("p2", 2, { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 });
    const stint = makeStint("s1", "FP1", cold, [p1, p2]);

    const result = getEffectiveColdForReference(stint, "p2");
    expect(result.FL).toBeCloseTo(1.15, 4);  // 1.3 − 0.15
    expect(result.FR).toBeCloseTo(1.3, 4);   // no bleed
    expect(result.RL).toBeCloseTo(1.3, 4);   // no bleed
    expect(result.RR).toBeCloseTo(1.2, 4);   // 1.3 − 0.10
  });
});

// ─── computeRecommendation with multi-pitstop bleed ─────────────────

describe("computeRecommendation – multi-pitstop bleed scenario", () => {
  const settings: AppSettings = { ...DEFAULT_APP_SETTINGS };

  it("matches Excel result: cold=1.3, p1=2.1→bled 1.95, p2=1.99→bled 1.95 → nextCold=1.11", () => {
    // Set up a stint with 2 pitstops + a "current" pitstop 3 that needs recommendation
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }
    );
    const p2 = makePitstop(
      "p2", 2,
      { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }
    );
    const p3 = makePitstop("p3", 3, {});  // current pitstop awaiting recommendation

    const stint = makeStint("s1", "FP1", cold, [p1, p2, p3], {
      singleTarget: 1.95,
      ambient: 25,
      asphalt: 30,
    });
    const event = makeEvent([stint]);

    const result = computeRecommendation({
      currentEvent: event,
      currentStintId: "s1",
      currentPitstopId: "p3",
      nextConditions: { ambientTemp: 25, asphaltTemp: 30 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.95 },
      priorEvents: [],
      settings,
      compound: "medium",
    });

    // Expected: Ceff = 1.3 + (1.95-2.1) + (1.95-1.99) = 1.3 - 0.15 - 0.04 = 1.11
    // feedback = 1.95 - 1.99 = -0.04   (using p2 as reference)
    // Wait — the engine uses p2 as reference, so Ceff only includes p1's bleed:
    //   Ceff = 1.3 + (1.95-2.1) = 1.15
    //   feedback = 1.95 - 1.99 = -0.04
    //   nextCold = 1.15 + (-0.04) = 1.11
    expect(result.recommendedColdPressures.FL).toBeCloseTo(1.11, 2);
    expect(result.recommendedColdPressures.FR).toBeCloseTo(1.11, 2);
    expect(result.recommendedColdPressures.RL).toBeCloseTo(1.11, 2);
    expect(result.recommendedColdPressures.RR).toBeCloseTo(1.11, 2);

    // Predicted hot should be on target (1.95)
    expect(result.predictedHotPressures.FL).toBeCloseTo(1.95, 2);

    // Rationale should mention the bleed adjustment
    expect(result.rationaleText).toContain("prior bleeds");
  });

  it("no bleed adjustment for single-pitstop reference", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.0, FR: 2.0, RL: 2.0, RR: 2.0 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }
    );
    // Pitstop 2 is the current one — reference is p1, which is first, so no prior bleeds
    const p2 = makePitstop("p2", 2, {});
    const stint = makeStint("s1", "FP1", cold, [p1, p2], {
      singleTarget: 1.95,
      ambient: 25,
      asphalt: 30,
    });
    const event = makeEvent([stint]);

    const result = computeRecommendation({
      currentEvent: event,
      currentStintId: "s1",
      currentPitstopId: "p2",
      nextConditions: { ambientTemp: 25, asphaltTemp: 30 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.95 },
      priorEvents: [],
      settings,
      compound: "medium",
    });

    // refCold = 1.3 (baseline, no prior bleeds), feedback = 1.95 - 2.0 = -0.05
    // nextCold = 1.3 + (-0.05) = 1.25
    expect(result.recommendedColdPressures.FL).toBeCloseTo(1.25, 2);

    // Rationale should NOT mention bleed adjustment
    expect(result.rationaleText).not.toContain("prior bleeds");
  });

  it("cross-stint reference also uses effective cold (prior event)", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }
    );
    const p2 = makePitstop(
      "p2", 2,
      { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 },
    );
    const priorStint = makeStint("s1", "FP1", cold, [p1, p2], {
      singleTarget: 1.95,
      ambient: 25,
      asphalt: 30,
    });
    const priorEvent = makeEvent([priorStint]);

    // New event, new stint with no data yet — should fall through to prior event
    const currentP1 = makePitstop("cp1", 1, {});
    const currentStint = makeStint("cs1", "Race", { FL: 1.4, FR: 1.4, RL: 1.4, RR: 1.4 }, [currentP1], {
      singleTarget: 1.95,
      ambient: 25,
      asphalt: 30,
    });
    const currentEvent = makeEvent([currentStint]);
    currentEvent.id = "evt-2";

    const result = computeRecommendation({
      currentEvent,
      currentStintId: "cs1",
      currentPitstopId: "cp1",
      nextConditions: { ambientTemp: 25, asphaltTemp: 30 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.95 },
      priorEvents: [priorEvent],
      settings,
      compound: "medium",
    });

    // Prior event uses p2 as reference; Ceff = 1.3 + (1.95-2.1) = 1.15
    // feedback = 1.95 - 1.99 = -0.04
    // nextCold = 1.15 - 0.04 = 1.11 (plus potential carry-over bias)
    // With same conditions, condCorr=0
    // Carry-over is small but nonzero — let's just verify the bleed adjustment was applied
    expect(result.recommendedColdPressures.FL).toBeLessThan(1.25);
  });
});

// ─── selectReference uses effective cold ────────────────────────────

describe("selectReference – bleed-adjusted cold pressures", () => {
  it("returns effective cold including bleed adjustments", () => {
    const cold = { FL: 1.3, FR: 1.3, RL: 1.3, RR: 1.3 };
    const p1 = makePitstop(
      "p1", 1,
      { FL: 2.1, FR: 2.1, RL: 2.1, RR: 2.1 },
      { FL: 1.95, FR: 1.95, RL: 1.95, RR: 1.95 }
    );
    const p2 = makePitstop(
      "p2", 2,
      { FL: 1.99, FR: 1.99, RL: 1.99, RR: 1.99 },
    );
    const p3 = makePitstop("p3", 3, {});
    const stint = makeStint("s1", "FP1", cold, [p1, p2, p3], { singleTarget: 1.95 });
    const event = makeEvent([stint]);

    const ref = selectReference(event, "s1", "p3", [], "single");

    expect(ref).toBeDefined();
    // Reference is p2; effective cold = 1.3 + (1.95-2.1) = 1.15
    expect(ref!.coldPressures.FL).toBeCloseTo(1.15, 4);
  });
});
