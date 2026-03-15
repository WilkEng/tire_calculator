import { describe, it, expect } from "vitest";
import {
  computeRecommendation,
  computeFeedbackCorrection,
  computeConditionCorrection,
  computeEffectiveTempDelta,
  computeCarryOverConfidence,
  selectReference,
  expandTargets,
  getEffectiveTargetPerCorner,
  type RecommendationInput,
} from "@/lib/engine/pressureEngine";
import {
  makeReferencePitstop,
  makeNextPitstop,
  makeSession,
  makeFrontRearPitstop,
  makeFourCornerPitstop,
  TEST_SETTINGS,
} from "../fixtures/testData";

// ─── expandTargets ─────────────────────────────────────────────────

describe("expandTargets", () => {
  it("expands single target to all corners", () => {
    const result = expandTargets("single", { singleTargetHotPressure: 1.85 });
    expect(result).toEqual({ FL: 1.85, FR: 1.85, RL: 1.85, RR: 1.85 });
  });

  it("expands front-rear targets", () => {
    const result = expandTargets("front-rear", {
      frontTargetHotPressure: 1.85,
      rearTargetHotPressure: 1.80,
    });
    expect(result).toEqual({ FL: 1.85, FR: 1.85, RL: 1.80, RR: 1.80 });
  });

  it("expands four-corner targets", () => {
    const result = expandTargets("four-corner", {
      cornerTargets: { FL: 1.85, FR: 1.83, RL: 1.80, RR: 1.78 },
    });
    expect(result).toEqual({ FL: 1.85, FR: 1.83, RL: 1.80, RR: 1.78 });
  });
});

// ─── getEffectiveTargetPerCorner ───────────────────────────────────

describe("getEffectiveTargetPerCorner", () => {
  it("uses target when no corrected pressure", () => {
    const pitstop = makeReferencePitstop();
    const result = getEffectiveTargetPerCorner(pitstop);
    expect(result.FL).toBe(1.85);
  });

  it("prefers corrected pressure when available", () => {
    const pitstop = makeReferencePitstop({
      hotCorrectedPressures: { FL: 1.83, FR: 1.83, RL: 1.83, RR: 1.83 },
    });
    const result = getEffectiveTargetPerCorner(pitstop);
    expect(result.FL).toBe(1.83);
  });
});

// ─── computeFeedbackCorrection ─────────────────────────────────────

describe("computeFeedbackCorrection", () => {
  it("returns positive when car came in cold", () => {
    // target=1.85, measured=1.83 → need +0.02
    expect(computeFeedbackCorrection(1.85, 1.83)).toBeCloseTo(0.02, 4);
  });

  it("returns negative when car came in hot", () => {
    // target=1.85, measured=1.87 → need -0.02
    expect(computeFeedbackCorrection(1.85, 1.87)).toBeCloseTo(-0.02, 4);
  });

  it("returns zero when on target", () => {
    expect(computeFeedbackCorrection(1.85, 1.85)).toBe(0);
  });
});

// ─── computeEffectiveTempDelta ─────────────────────────────────────

describe("computeEffectiveTempDelta", () => {
  const coeffs = { kTemp: 0.012, kTrack: 1.75, kAmbient: 1.0 };

  it("returns zero when conditions are identical", () => {
    const delta = computeEffectiveTempDelta(22, 38, 25, 22, 38, 25, coeffs);
    expect(delta).toBe(0);
  });

  it("computes correctly with warmer conditions", () => {
    // ambient: +2°C, asphalt: +4°C, tire: same
    const delta = computeEffectiveTempDelta(22, 38, 25, 24, 42, 25, coeffs);
    // (24-22)*1.0 + (42-38)*1.75 + (25-25)*1.0 = 2 + 7 = 9
    expect(delta).toBeCloseTo(9, 4);
  });

  it("computes correctly with cooler conditions", () => {
    // ambient: -3°C, asphalt: -5°C, tire: same
    const delta = computeEffectiveTempDelta(22, 38, 25, 19, 33, 25, coeffs);
    // (-3)*1.0 + (-5)*1.75 = -3 + -8.75 = -11.75
    expect(delta).toBeCloseTo(-11.75, 4);
  });

  it("includes tire temp delta", () => {
    // only tire temp changes: +5°C
    const delta = computeEffectiveTempDelta(22, 38, 25, 22, 38, 30, coeffs);
    expect(delta).toBeCloseTo(5, 4);
  });
});

// ─── computeConditionCorrection ────────────────────────────────────

describe("computeConditionCorrection", () => {
  it("computes classic mode correction", () => {
    // effectiveTempDelta = 9 (from above), kTemp = 0.012
    const corr = computeConditionCorrection(9, 0.012);
    expect(corr).toBeCloseTo(0.108, 4);
  });

  it("returns zero for zero delta", () => {
    expect(computeConditionCorrection(0, 0.012)).toBe(0);
  });
});

// ─── selectReference ───────────────────────────────────────────────

describe("selectReference", () => {
  it("selects same-session similar stint first", () => {
    const session = makeSession({
      pitstops: [
        makeReferencePitstop({ index: 1 }),
        makeNextPitstop({ index: 2 }),
      ],
    });
    const ref = selectReference(session, 2, [], "single");
    expect(ref).toBeDefined();
    expect(ref!.source).toBe("same-session-similar");
    expect(ref!.pitstop.index).toBe(1);
  });

  it("falls back to same-session nearest if different mode", () => {
    const session = makeSession({
      pitstops: [
        makeReferencePitstop({ index: 1, targetMode: "front-rear" }),
        makeNextPitstop({ index: 2 }),
      ],
    });
    // Looking for "single" mode but only have "front-rear"
    const ref = selectReference(session, 2, [], "single");
    expect(ref).toBeDefined();
    expect(ref!.source).toBe("same-session-nearest");
  });

  it("returns undefined when no reference data exists", () => {
    const session = makeSession({
      pitstops: [makeNextPitstop({ index: 1 })], // no cold/hot data
    });
    const ref = selectReference(session, 1, [], "single");
    expect(ref).toBeUndefined();
  });

  it("finds prior session reference at same track", () => {
    const current = makeSession({ pitstops: [makeNextPitstop({ index: 1 })] });
    const prior = makeSession({
      id: "session-2",
      pitstops: [makeReferencePitstop({ index: 1 })],
    });

    const ref = selectReference(current, 1, [prior], "single");
    expect(ref).toBeDefined();
    expect(ref!.source).toBe("prior-session-same-track-same-mode");
  });
});

// ─── computeRecommendation (integration) ───────────────────────────

describe("computeRecommendation", () => {
  it("returns classic fallback when no reference", () => {
    const session = makeSession({ pitstops: [] });
    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 1,
      nextConditions: { ambientTemp: 22, asphaltTemp: 38 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      priorSessions: [],
      settings: TEST_SETTINGS,
    };
    const rec = computeRecommendation(input);
    expect(rec.referenceSource).toBe("classic-mode-fallback");
    expect(rec.recommendedColdPressures.FL).toBe(1.85); // target = cold guess
    expect(rec.rationaleText).toContain("No reference stint available");
  });

  it("computes correct recommendation with single target mode", () => {
    const session = makeSession({
      pitstops: [
        makeReferencePitstop({ index: 1 }),
        makeNextPitstop({ index: 2 }),
      ],
    });

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 2,
      nextConditions: { ambientTemp: 24, asphaltTemp: 42 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      priorSessions: [],
      settings: TEST_SETTINGS,
    };

    const rec = computeRecommendation(input);
    expect(rec.referenceSource).toBe("same-session-similar");

    // FL: refCold=1.70, feedback=1.85-1.87=-0.02, condCorr=9*0.012=0.108
    // nextCold = 1.70 + (-0.02) - 0.108 = 1.572
    expect(rec.recommendedColdPressures.FL).toBeCloseTo(1.572, 2);
    expect(rec.rationaleText).toContain("pitstop 1");
    expect(rec.rationaleText).toContain("bar high");
  });

  it("handles front-rear target mode", () => {
    const session = makeSession({
      pitstops: [
        makeFrontRearPitstop(),
        makeNextPitstop({ index: 2, targetMode: "front-rear" }),
      ],
    });

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 2,
      nextConditions: { ambientTemp: 22, asphaltTemp: 38 },
      targetMode: "front-rear",
      targets: { frontTargetHotPressure: 1.85, rearTargetHotPressure: 1.80 },
      priorSessions: [],
      settings: TEST_SETTINGS,
    };

    const rec = computeRecommendation(input);
    expect(rec.referenceSource).toBe("same-session-similar");
    // Same conditions → condCorr = 0, so only feedback matters
    // FL: 1.70 + (1.85 - 1.87) = 1.70 - 0.02 = 1.68
    expect(rec.recommendedColdPressures.FL).toBeCloseTo(1.68, 2);
    // RL: 1.65 + (1.80 - 1.82) = 1.65 - 0.02 = 1.63
    expect(rec.recommendedColdPressures.RL).toBeCloseTo(1.63, 2);
  });

  it("handles four-corner target mode", () => {
    const session = makeSession({
      pitstops: [
        makeFourCornerPitstop(),
        makeNextPitstop({ index: 2, targetMode: "four-corner" }),
      ],
    });

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 2,
      nextConditions: { ambientTemp: 22, asphaltTemp: 38 },
      targetMode: "four-corner",
      targets: {
        cornerTargets: { FL: 1.85, FR: 1.83, RL: 1.80, RR: 1.78 },
      },
      priorSessions: [],
      settings: TEST_SETTINGS,
    };

    const rec = computeRecommendation(input);
    expect(rec.referenceSource).toBe("same-session-similar");
    // FL: 1.70 + (1.85 - 1.87) = 1.68
    expect(rec.recommendedColdPressures.FL).toBeCloseTo(1.68, 2);
    // RR: 1.63 + (1.78 - 1.80) = 1.61
    expect(rec.recommendedColdPressures.RR).toBeCloseTo(1.61, 2);
  });

  it("uses corrected pressure when present", () => {
    const session = makeSession({
      pitstops: [
        makeReferencePitstop({
          index: 1,
          hotCorrectedPressures: { FL: 1.83, FR: 1.83, RL: 1.83, RR: 1.83 },
        }),
        makeNextPitstop({ index: 2 }),
      ],
    });

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 2,
      nextConditions: { ambientTemp: 22, asphaltTemp: 38 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      priorSessions: [],
      settings: TEST_SETTINGS,
    };

    const rec = computeRecommendation(input);
    // FL: refCold=1.70, feedback=1.83-1.87=-0.04 (corrected target used!), condCorr=0
    // nextCold = 1.70 + (-0.04) = 1.66
    expect(rec.recommendedColdPressures.FL).toBeCloseTo(1.66, 2);
  });

  it("works with carry-over disabled", () => {
    const session = makeSession({
      pitstops: [
        makeReferencePitstop({ index: 1 }),
        makeNextPitstop({ index: 2 }),
      ],
    });

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: 2,
      nextConditions: { ambientTemp: 24, asphaltTemp: 42 },
      targetMode: "single",
      targets: { singleTargetHotPressure: 1.85 },
      priorSessions: [],
      settings: { ...TEST_SETTINGS, carryOverEnabled: false },
    };

    const rec = computeRecommendation(input);
    // Same result as with carry-over on because no prior sessions exist
    expect(rec.recommendedColdPressures.FL).toBeCloseTo(1.572, 2);
  });
});

// ─── computeCarryOverConfidence ────────────────────────────────────

describe("computeCarryOverConfidence", () => {
  it("gives high confidence for same-session similar stint", () => {
    const ref = {
      pitstop: makeReferencePitstop(),
      source: "same-session-similar" as const,
      sameSession: true,
    };
    const conf = computeCarryOverConfidence(ref, "single", 22, "Spa", "Spa");
    expect(conf).toBeGreaterThan(0.7);
  });

  it("gives low confidence for prior session different track", () => {
    const ref = {
      pitstop: makeReferencePitstop(),
      source: "prior-session-same-track" as const,
      sameSession: false,
    };
    const conf = computeCarryOverConfidence(
      ref,
      "single",
      22,
      "Monza",
      "Spa"
    );
    expect(conf).toBeLessThan(0.5);
  });
});
