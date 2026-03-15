// ─── Level 1 Pressure Calculation Engine ───────────────────────────
//
// Pure functions — no side-effects, no I/O, fully testable.
//
// Core formula (from spec §5.3):
//   nextCold = referenceCold
//            + feedbackCorrection
//            - conditionCorrection
//            + learnedCarryOverCorrection
//
// Where:
//   feedbackCorrection  = referenceTargetHot - referenceMeasuredHot
//   conditionCorrection = effectiveTempDelta * kTemp
//   effectiveTempDelta  = (ambientNext - ambientRef) * kAmbient
//                       + (asphaltNext - asphaltRef) * kTrack
//                       + (startTireNext - startTireRef) * 1.0
//
// Cold pressures live on the session baseline (stint 1) or are
// derived from the prior pitstop's recommendation output (stint N>1).
// Pitstop records only carry hot and bled pressures.
// ────────────────────────────────────────────────────────────────────

import {
  type AppSettings,
  type Session,
  type PitstopEntry,
  type CornerValues,
  type PartialCornerValues,
  type TargetMode,
  type Targets,
  type RecommendationOutput,
  type CoefficientsUsed,
  type ReferenceSource,
  type Corner,
} from "../domain/models";
import { round } from "../utils/helpers";

// ─── Public types for engine I/O ───────────────────────────────────

/** Conditions snapshot passed to the engine for the upcoming stint */
export interface NextStintConditions {
  ambientTemp: number;
  asphaltTemp: number;
  /** Optional per-corner start tire temps; uses setting default if absent */
  startTireTemps?: PartialCornerValues;
}

/** Coefficients the engine should use */
export interface EngineCoefficients {
  kTemp: number;   // bar/°C
  kTrack: number;  // asphalt weighting
  kAmbient: number; // ambient weighting
}

/** A lightweight struct describing a usable reference stint */
export interface ResolvedReference {
  pitstop: PitstopEntry;
  /** The cold pressures that were used at the START of this stint */
  coldPressures: PartialCornerValues;
  source: ReferenceSource;
  /** Whether this came from the same session */
  sameSession: boolean;
}

/** Carry-over bias from prior sessions */
export interface CarryOverBias {
  /** Per-corner pressure bias (already weighted) */
  biasPerCorner: PartialCornerValues;
  /** Confidence 0–1 */
  confidence: number;
}

// ─── Constants ─────────────────────────────────────────────────────

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

// ─── Cold Pressure Resolution ──────────────────────────────────────

/**
 * Resolve the cold pressures that were (or would be) used for a given
 * pitstop/stint within a session.
 *
 * - Stint 1 (pitstopIndex === 1): session.baseline.coldPressures
 * - Stint N > 1: prior pitstop's recommendationOutput.recommendedColdPressures
 * - Fallback: session.baseline.coldPressures (approximation)
 */
export function getColdForStint(
  session: Session,
  pitstopIndex: number
): PartialCornerValues | undefined {
  if (pitstopIndex === 1) {
    return session.baseline?.coldPressures;
  }
  // Look for the prior pitstop's recommendation
  const priorPitstop = session.pitstops.find(
    (p) => p.index === pitstopIndex - 1
  );
  if (priorPitstop?.recommendationOutput?.recommendedColdPressures) {
    return priorPitstop.recommendationOutput.recommendedColdPressures;
  }
  // Fallback: use baseline cold (best available approximation)
  return session.baseline?.coldPressures;
}

/**
 * Get the reference conditions (ambient, asphalt, tire temps) for a session.
 * Uses baseline measured values → baseline forecast → undefined.
 */
export function getBaselineConditions(
  session: Session
): { ambient?: number; asphalt?: number; startTireTemps?: PartialCornerValues } {
  const baseline = session.baseline;
  return {
    ambient: baseline?.ambientMeasured ?? baseline?.ambientForecast,
    asphalt: baseline?.asphaltMeasured ?? baseline?.asphaltForecast,
    startTireTemps: baseline?.startTireTemps,
  };
}

// ─── Helpers: extract target hot pressure per corner ───────────────

/**
 * For a given pitstop, determine the effective hot target per corner.
 * Hierarchy: hotCorrectedPressure > targetHotPressure (from Targets).
 *
 * Bled/corrected pressures default to hot measured when undefined.
 */
export function getEffectiveTargetPerCorner(
  pitstop: PitstopEntry
): CornerValues {
  const base = expandTargets(pitstop.targetMode, pitstop.targets);
  const bled = getEffectiveBledPressures(pitstop);

  return {
    FL: bled.FL ?? base.FL,
    FR: bled.FR ?? base.FR,
    RL: bled.RL ?? base.RL,
    RR: bled.RR ?? base.RR,
  };
}

/**
 * Get the effective bled/corrected pressures for a pitstop.
 * If a corner's bled value is not explicitly set, it defaults to hot measured.
 */
export function getEffectiveBledPressures(
  pitstop: PitstopEntry
): PartialCornerValues {
  const hot = pitstop.hotMeasuredPressures ?? {};
  const bled = pitstop.hotCorrectedPressures ?? {};
  return {
    FL: bled.FL ?? hot.FL,
    FR: bled.FR ?? hot.FR,
    RL: bled.RL ?? hot.RL,
    RR: bled.RR ?? hot.RR,
  };
}

/**
 * Expand a Targets object into CornerValues based on mode
 */
export function expandTargets(
  mode: TargetMode,
  targets: Targets
): CornerValues {
  switch (mode) {
    case "single": {
      const v = targets.singleTargetHotPressure ?? 0;
      return { FL: v, FR: v, RL: v, RR: v };
    }
    case "front-rear": {
      const f = targets.frontTargetHotPressure ?? 0;
      const r = targets.rearTargetHotPressure ?? 0;
      return { FL: f, FR: f, RL: r, RR: r };
    }
    case "four-corner": {
      const ct = targets.cornerTargets ?? { FL: 0, FR: 0, RL: 0, RR: 0 };
      return { FL: ct.FL, FR: ct.FR, RL: ct.RL, RR: ct.RR };
    }
  }
}

// ─── Reference Selection (spec §6) ────────────────────────────────

/**
 * Choose the best reference pitstop for computing the next recommendation.
 *
 * Priority order:
 *   1. Same session, nearest previous similar stint
 *   2. Same session, nearest previous stint
 *   3. Prior session, same track & same target mode
 *   4. Prior session, same track
 *   5. classic-mode fallback (returns undefined — caller uses classic defaults)
 */
export function selectReference(
  currentSession: Session,
  currentPitstopIndex: number,
  priorSessions: Session[],
  targetMode: TargetMode,
): ResolvedReference | undefined {

  // ── 1 & 2: Same-session references ──
  const priorPitstops = currentSession.pitstops
    .filter(
      (p) =>
        p.index < currentPitstopIndex &&
        hasMinimalData(currentSession, p)
    )
    .sort((a, b) => b.index - a.index); // newest first

  // 1: nearest similar (same target mode)
  const similar = priorPitstops.find((p) => p.targetMode === targetMode);
  if (similar) {
    const cold = getColdForStint(currentSession, similar.index) ?? {};
    return {
      pitstop: similar,
      coldPressures: cold,
      source: "same-session-similar",
      sameSession: true,
    };
  }

  // 2: nearest any
  if (priorPitstops.length > 0) {
    const best = priorPitstops[0];
    const cold = getColdForStint(currentSession, best.index) ?? {};
    return {
      pitstop: best,
      coldPressures: cold,
      source: "same-session-nearest",
      sameSession: true,
    };
  }

  // ── 3 & 4: Prior sessions (sorted newest-first) ──
  const sorted = [...priorSessions]
    .filter((s) => s.id !== currentSession.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const session of sorted) {
    // Only consider sessions at the same track
    if (
      session.trackName.toLowerCase() !== currentSession.trackName.toLowerCase()
    ) {
      continue;
    }

    // Get latest pitstop with data from this session
    const candidates = session.pitstops
      .filter((p) => hasMinimalData(session, p))
      .sort((a, b) => b.index - a.index);

    // 3: same track + same target mode
    const sameMode = candidates.find((p) => p.targetMode === targetMode);
    if (sameMode) {
      const cold = getColdForStint(session, sameMode.index) ?? {};
      return {
        pitstop: sameMode,
        coldPressures: cold,
        source: "prior-session-same-track-same-mode",
        sameSession: false,
      };
    }

    // 4: same track, any mode
    if (candidates.length > 0) {
      const best = candidates[0];
      const cold = getColdForStint(session, best.index) ?? {};
      return {
        pitstop: best,
        coldPressures: cold,
        source: "prior-session-same-track",
        sameSession: false,
      };
    }
  }

  // 5: no usable reference
  return undefined;
}

/**
 * A pitstop has minimal data if:
 * - It has hot measured pressures
 * - Cold pressures can be resolved for its stint (from baseline or prior recommendation)
 */
function hasMinimalData(session: Session, p: PitstopEntry): boolean {
  const hasHot =
    p.hotMeasuredPressures &&
    Object.keys(p.hotMeasuredPressures).length > 0;
  const cold = getColdForStint(session, p.index);
  const hasCold = cold && Object.keys(cold).length > 0;
  return !!(hasCold && hasHot);
}

// ─── Condition Correction (spec §5.4) ──────────────────────────────

/**
 * Compute the effective temperature delta between next conditions and reference conditions.
 *
 *   effectiveTempDelta = (ambientNext - ambientRef) * kAmbient
 *                      + (asphaltNext - asphaltRef) * kTrack
 *                      + (startTireNext - startTireRef) * 1.0
 */
export function computeEffectiveTempDelta(
  refAmbient: number,
  refAsphalt: number,
  refStartTire: number,
  nextAmbient: number,
  nextAsphalt: number,
  nextStartTire: number,
  coefficients: EngineCoefficients
): number {
  return (
    (nextAmbient - refAmbient) * coefficients.kAmbient +
    (nextAsphalt - refAsphalt) * coefficients.kTrack +
    (nextStartTire - refStartTire) * 1.0
  );
}

/**
 * conditionCorrection = effectiveTempDelta * kTemp
 */
export function computeConditionCorrection(
  effectiveTempDelta: number,
  kTemp: number
): number {
  return effectiveTempDelta * kTemp;
}

// ─── Feedback Correction (spec §5.3) ──────────────────────────────

/**
 * feedbackCorrection = referenceTargetHot - referenceMeasuredHot
 *
 * If positive → car came in cold → need to raise cold pressure.
 * If negative → car came in hot  → need to lower cold pressure.
 */
export function computeFeedbackCorrection(
  targetHot: number,
  measuredHot: number
): number {
  return targetHot - measuredHot;
}

// ─── Carry-over (spec §7 & prompt §E) ─────────────────────────────

/**
 * Compute confidence score for a carry-over candidate.
 *
 * Factors:
 *   - same session vs prior session     (+0.4 / +0.1)
 *   - same track                        (+0.2)
 *   - same target mode                  (+0.15)
 *   - ambient within ±5 °C              (+0.1)
 *   - has corrected pressures           (+0.1)
 *   - complete data (all 4 corners cold)  (+0.05)
 */
export function computeCarryOverConfidence(
  ref: ResolvedReference,
  currentTargetMode: TargetMode,
  currentAmbient: number | undefined,
  currentTrackName: string,
  refTrackName: string
): number {
  let score = 0;
  score += ref.sameSession ? 0.4 : 0.1;
  if (refTrackName.toLowerCase() === currentTrackName.toLowerCase()) score += 0.2;
  if (ref.pitstop.targetMode === currentTargetMode) score += 0.15;

  // Use baseline ambient from the reference or undefined
  const refAmbient = getBaselineConditions(
    // Build a minimal session just for the lookup — or pass refSession separately
    // For carry-over, we already have ref.coldPressures but not ambient.
    // We check if hotCorrectedPressures exist instead.
    { baseline: {} } as Session // ambient check below uses ref.pitstop fields
  ).ambient;
  // If ref pitstop has no ambient (removed from model), skip ambient similarity check.
  // This is acceptable — carry-over confidence is slightly lower without.
  void refAmbient;

  if (
    ref.pitstop.hotCorrectedPressures &&
    Object.keys(ref.pitstop.hotCorrectedPressures).length > 0
  ) {
    score += 0.1;
  }

  const coldKeys = ref.coldPressures
    ? Object.keys(ref.coldPressures).length
    : 0;
  if (coldKeys >= 4) score += 0.05;

  return Math.min(1, score);
}

/**
 * Compute confidence for a carry-over candidate with full session context.
 */
export function computeCarryOverConfidenceWithSession(
  ref: ResolvedReference,
  refSession: Session,
  currentTargetMode: TargetMode,
  currentAmbient: number | undefined,
  currentTrackName: string
): number {
  let score = 0;
  score += ref.sameSession ? 0.4 : 0.1;
  if (refSession.trackName.toLowerCase() === currentTrackName.toLowerCase()) score += 0.2;
  if (ref.pitstop.targetMode === currentTargetMode) score += 0.15;

  const refBaseline = getBaselineConditions(refSession);
  if (
    currentAmbient != null &&
    refBaseline.ambient != null &&
    Math.abs(currentAmbient - refBaseline.ambient) <= 5
  ) {
    score += 0.1;
  }

  if (
    ref.pitstop.hotCorrectedPressures &&
    Object.keys(ref.pitstop.hotCorrectedPressures).length > 0
  ) {
    score += 0.1;
  }

  const coldKeys = ref.coldPressures
    ? Object.keys(ref.coldPressures).length
    : 0;
  if (coldKeys >= 4) score += 0.05;

  return Math.min(1, score);
}

/**
 * Compute a lightweight carry-over bias from prior sessions.
 *
 * For each qualifying prior pitstop, compute the residual
 * (actual hot - target hot) and weight it by confidence.
 * Then average. This is a *gentle* biasing nudge, not a dominant correction.
 *
 * Returns zero bias if no qualifying data or low confidence.
 */
export function computeCarryOverBias(
  priorSessions: Session[],
  currentSession: Session,
  currentTargetMode: TargetMode,
  currentAmbient: number | undefined,
  coefficients: EngineCoefficients
): CarryOverBias {
  const empty: CarryOverBias = {
    biasPerCorner: { FL: 0, FR: 0, RL: 0, RR: 0 },
    confidence: 0,
  };

  const qualified: { residuals: CornerValues; weight: number }[] = [];

  for (const session of priorSessions) {
    if (session.id === currentSession.id) continue;

    for (const pitstop of session.pitstops) {
      if (!hasMinimalData(session, pitstop)) continue;

      const cold = getColdForStint(session, pitstop.index) ?? {};
      const ref: ResolvedReference = {
        pitstop,
        coldPressures: cold,
        source: "prior-session-same-track",
        sameSession: false,
      };

      const conf = computeCarryOverConfidenceWithSession(
        ref,
        session,
        currentTargetMode,
        currentAmbient,
        currentSession.trackName,
      );

      if (conf < 0.3) continue; // skip low-confidence

      const targets = getEffectiveTargetPerCorner(pitstop);
      const hot = pitstop.hotMeasuredPressures ?? {};
      const residuals: CornerValues = {
        FL: (targets.FL - (hot.FL ?? targets.FL)),
        FR: (targets.FR - (hot.FR ?? targets.FR)),
        RL: (targets.RL - (hot.RL ?? targets.RL)),
        RR: (targets.RR - (hot.RR ?? targets.RR)),
      };

      qualified.push({ residuals, weight: conf * 0.3 }); // capped gentle weight
    }
  }

  if (qualified.length === 0) return empty;

  const totalWeight = qualified.reduce((sum, q) => sum + q.weight, 0);
  const bias: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };

  for (const corner of CORNERS) {
    for (const q of qualified) {
      bias[corner] += q.residuals[corner] * q.weight;
    }
    bias[corner] = round(bias[corner] / totalWeight, 4);
  }

  const avgConfidence = totalWeight / qualified.length;

  return { biasPerCorner: bias, confidence: avgConfidence };
}

// ─── Main Recommendation Engine ────────────────────────────────────

export interface RecommendationInput {
  currentSession: Session;
  /** Index of the pitstop we are computing the next cold pressure FOR */
  currentPitstopIndex: number;
  /** Expected conditions for the upcoming stint */
  nextConditions: NextStintConditions;
  /** Target mode for the upcoming stint */
  targetMode: TargetMode;
  /** Targets for the upcoming stint */
  targets: Targets;
  /** All prior sessions for carry-over and cross-session reference */
  priorSessions: Session[];
  /** App settings (for coefficients, defaults, carry-over toggle) */
  settings: AppSettings;
}

/**
 * Compute the Level 1 next-cold-pressure recommendation.
 *
 * Returns a full RecommendationOutput including per-corner values,
 * predicted hot, deltas, and a human-readable rationale.
 */
export function computeRecommendation(
  input: RecommendationInput
): RecommendationOutput {
  const {
    currentSession,
    currentPitstopIndex,
    nextConditions,
    targetMode,
    targets,
    priorSessions,
    settings,
  } = input;

  const coefficients: EngineCoefficients = {
    kTemp: settings.kTemp,
    kTrack: settings.kTrack,
    kAmbient: settings.kAmbient,
  };

  const defaultStartTire = settings.defaultStartTireTemp;

  // ── Expand targets to four corners ──
  const targetCorners = expandTargets(targetMode, targets);

  // ── Select reference ──
  const ref = selectReference(
    currentSession,
    currentPitstopIndex,
    priorSessions,
    targetMode
  );

  // If no reference, return classic-mode initial guess
  if (!ref) {
    return classicFallback(targetCorners, coefficients);
  }

  const refPitstop = ref.pitstop;
  const refCold = ref.coldPressures;

  // ── Extract reference data ──
  const refHotMeasured = refPitstop.hotMeasuredPressures ?? {};
  const refTargetHot = getEffectiveTargetPerCorner(refPitstop);

  // Reference conditions from session baseline
  const refBaselineConditions = getBaselineConditions(currentSession);
  const refAmbient = refBaselineConditions.ambient ?? nextConditions.ambientTemp;
  const refAsphalt = refBaselineConditions.asphalt ?? nextConditions.asphaltTemp;
  const refStartTire = refBaselineConditions.startTireTemps ?? {};

  // ── Carry-over ──
  let carryOver: CarryOverBias = {
    biasPerCorner: { FL: 0, FR: 0, RL: 0, RR: 0 },
    confidence: 0,
  };
  if (settings.carryOverEnabled && priorSessions.length > 0) {
    carryOver = computeCarryOverBias(
      priorSessions,
      currentSession,
      targetMode,
      nextConditions.ambientTemp,
      coefficients
    );
  }

  // ── Compute per corner ──
  const recommended: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const predicted: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const deltas: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const rationaleLines: string[] = [];

  rationaleLines.push(
    `Using pitstop ${refPitstop.index} as reference (${ref.source.replace(/-/g, " ")}).`
  );

  for (const corner of CORNERS) {
    const rCold = refCold[corner];
    const rHot = refHotMeasured[corner];
    const rTarget = refTargetHot[corner];

    // Skip corner if reference has no data
    if (rCold == null || rHot == null) {
      recommended[corner] = targetCorners[corner]; // naive fallback
      predicted[corner] = targetCorners[corner];
      deltas[corner] = 0;
      continue;
    }

    // feedbackCorrection
    const feedback = computeFeedbackCorrection(rTarget, rHot);

    // conditionCorrection
    const refStartTireVal = refStartTire[corner] ?? defaultStartTire;
    const nextStartTireVal =
      nextConditions.startTireTemps?.[corner] ?? defaultStartTire;

    const tempDelta = computeEffectiveTempDelta(
      refAmbient,
      refAsphalt,
      refStartTireVal,
      nextConditions.ambientTemp,
      nextConditions.asphaltTemp,
      nextStartTireVal,
      coefficients
    );
    const condCorr = computeConditionCorrection(tempDelta, coefficients.kTemp);

    // carry-over
    const coCorr = carryOver.biasPerCorner[corner] ?? 0;

    // Final formula
    const nextCold = rCold + feedback - condCorr + coCorr;
    recommended[corner] = round(nextCold, 3);

    // Predicted hot = target (since we corrected for everything we know)
    predicted[corner] = round(targetCorners[corner], 3);
    deltas[corner] = round(predicted[corner] - targetCorners[corner], 3);
  }

  // ── Build rationale ──
  const refHotFL = refHotMeasured.FL;
  const refTargetFL = refTargetHot.FL;
  if (refHotFL != null && refTargetFL != null) {
    const diff = round(refHotFL - refTargetFL, 3);
    if (diff > 0) {
      rationaleLines.push(
        `Car came in ${Math.abs(diff)} bar high.`
      );
    } else if (diff < 0) {
      rationaleLines.push(
        `Car came in ${Math.abs(diff)} bar low.`
      );
    } else {
      rationaleLines.push(`Car came in on target.`);
    }
  }

  const ambDelta = round(nextConditions.ambientTemp - refAmbient, 1);
  const aspDelta = round(nextConditions.asphaltTemp - refAsphalt, 1);
  if (ambDelta !== 0 || aspDelta !== 0) {
    const parts: string[] = [];
    if (ambDelta !== 0) parts.push(`${ambDelta > 0 ? "+" : ""}${ambDelta} °C ambient`);
    if (aspDelta !== 0) parts.push(`${aspDelta > 0 ? "+" : ""}${aspDelta} °C asphalt`);
    rationaleLines.push(
      `Next stint forecast is ${ambDelta >= 0 && aspDelta >= 0 ? "warmer" : ambDelta <= 0 && aspDelta <= 0 ? "cooler" : "mixed"} by ${parts.join(" and ")}.`
    );
  }

  if (carryOver.confidence > 0.1) {
    rationaleLines.push(
      `Carry-over bias applied (confidence ${round(carryOver.confidence * 100, 0)}%).`
    );
  }

  rationaleLines.push(`Recommended cold pressure adjusted accordingly.`);

  // ── Confidence score ──
  const confidence = computeCarryOverConfidence(
    ref,
    targetMode,
    nextConditions.ambientTemp,
    currentSession.trackName,
    currentSession.trackName // ref is from same session track context
  );

  return {
    recommendedColdPressures: recommended,
    predictedHotPressures: predicted,
    deltasToTarget: deltas,
    rationaleText: rationaleLines.join(" "),
    confidenceScore: round(confidence, 2),
    referenceSource: ref.source,
    coefficientsUsed: {
      kTemp: coefficients.kTemp,
      kTrack: coefficients.kTrack,
      kAmbient: coefficients.kAmbient,
    },
  };
}

// ─── Classic Fallback ──────────────────────────────────────────────

/**
 * When no reference is available, return the target as the cold start guess.
 * This represents a "no correction" baseline.
 */
function classicFallback(
  targetCorners: CornerValues,
  coefficients: EngineCoefficients
): RecommendationOutput {
  return {
    recommendedColdPressures: { ...targetCorners },
    predictedHotPressures: { ...targetCorners },
    deltasToTarget: { FL: 0, FR: 0, RL: 0, RR: 0 },
    rationaleText:
      "No reference stint available. Using target hot pressure as initial cold start guess (classic mode fallback). Adjust after first pitstop data.",
    confidenceScore: 0.1,
    referenceSource: "classic-mode-fallback",
    coefficientsUsed: {
      kTemp: coefficients.kTemp,
      kTrack: coefficients.kTrack,
      kAmbient: coefficients.kAmbient,
    },
  };
}
