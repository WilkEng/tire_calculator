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
//   feedbackCorrection  = newTargetHot - referenceMeasuredHot
//                         (uses the NEW stint's target, not the reference stint's)
//   conditionCorrection = effectiveTempDelta * kTemp
//   effectiveTempDelta  = (ambientNext - ambientRef) * kAmbient
//                       + (asphaltNext - asphaltRef) * kTrack
//                       - (startTireNext - startTireRef) * 1.0
//
// Note: tire temp term is SUBTRACTED because warmer tires = less heat
// rise during the stint = need MORE cold pressure (opposite of ambient/asphalt).
//
// Cold pressures live on the stint baseline.
// Pitstop records only carry hot and bled pressures.
// ────────────────────────────────────────────────────────────────────

import {
  type AppSettings,
  type Session,
  type Stint,
  type PitstopEntry,
  type CornerValues,
  type PartialCornerValues,
  type TargetMode,
  type Targets,
  type RecommendationOutput,
  type CoefficientsUsed,
  type ReferenceSource,
  type Corner,
  type CompoundType,
  type CompoundCoefficients,
  COMPOUND_PRESETS,
} from "../domain/models";
import { round } from "../utils/helpers";

// ─── Compound coefficient resolver ─────────────────────────────────

/**
 * Resolve kAmbient and kTrack for a given compound type from settings.
 * Falls back to user-customized presets, then defaults.
 */
export function resolveCompoundCoefficients(
  compound: CompoundType | undefined,
  settings: AppSettings
): { kAmbient: number; kTrack: number } {
  if (!compound || compound === "custom") {
    return { kAmbient: settings.kAmbient, kTrack: settings.kTrack };
  }
  const userPresets = settings.compoundCoefficients ?? COMPOUND_PRESETS;
  const preset = userPresets[compound] ?? COMPOUND_PRESETS[compound];
  return { kAmbient: preset.kAmbient, kTrack: preset.kTrack };
}

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
  stint: Stint;
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
 * Resolve the cold pressures that were used for a given stint.
 * Now simply retrieves from the stint's baseline.
 */
export function getColdForStint(
  stint: Stint
): PartialCornerValues | undefined {
  return stint.baseline?.coldPressures;
}

/**
 * Get the reference conditions (ambient, asphalt, tire temps) for a stint.
 */
export function getBaselineConditions(
  stint: Stint
): { ambient?: number; asphalt?: number; startTireTemps?: PartialCornerValues } {
  const baseline = stint.baseline;
  return {
    ambient: baseline?.ambientMeasured,
    asphalt: baseline?.asphaltMeasured,
    startTireTemps: baseline?.startTireTemps,
  };
}

// ─── Helpers: extract target hot pressure per corner ───────────────

/**
 * For a given pitstop in a stint, determine the effective hot target per corner.
 * Hierarchy: hotCorrectedPressure > targetHotPressure (from Targets).
 *
 * Bled/corrected pressures default to hot measured when undefined.
 */
export function getEffectiveTargetPerCorner(
  stint: Stint,
  pitstop: PitstopEntry
): CornerValues {
  const base = expandTargets(stint.baseline.targetMode, stint.baseline.targets);
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
    default:
      return { FL: 0, FR:0, RL:0, RR:0 };
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
 *   5. classic-mode fallback (returns undefined)
 */
export function selectReference(
  currentSession: Session,
  currentStintId: string,
  currentPitstopId: string,
  priorSessions: Session[],
  targetMode: TargetMode,
): ResolvedReference | undefined {

  // Flatten same-session pitstops into ordered list of { stint, pitstop }
  const sameSessionCandidates: { stint: Stint, pitstop: PitstopEntry }[] = [];
  let foundCurrent = false;

  // We want to collect all pitstops that occurred BEFORE the current one in time.
  // Assuming stints and pitstops are in chronological order:
  let currentStint: Stint | undefined;
  let currentPitstop: PitstopEntry | undefined;
  for (const stint of currentSession.stints) {
    for (const pitstop of stint.pitstops) {
      if (stint.id === currentStintId && pitstop.id === currentPitstopId) {
        currentStint = stint;
        currentPitstop = pitstop;
        foundCurrent = true;
        break; 
      }
      if (hasMinimalData(stint, pitstop)) {
        sameSessionCandidates.push({ stint, pitstop });
      }
    }
    if (foundCurrent) break;
  }
  
  // Reverse to make it newest-first before the current point
  sameSessionCandidates.reverse();

  // 1: nearest similar (same target mode)
  const similar = sameSessionCandidates.find((c) => c.stint.baseline.targetMode === targetMode);
  if (similar) {
    const cold = getColdForStint(similar.stint) ?? {};
    return {
      stint: similar.stint,
      pitstop: similar.pitstop,
      coldPressures: cold,
      source: "same-session-similar",
      sameSession: true,
    };
  }

  // 2: nearest any
  if (sameSessionCandidates.length > 0) {
    const best = sameSessionCandidates[0];
    const cold = getColdForStint(best.stint) ?? {};
    return {
      stint: best.stint,
      pitstop: best.pitstop,
      coldPressures: cold,
      source: "same-session-nearest",
      sameSession: true,
    };
  }

  // 2.5: Self-reference — use the current pitstop itself when it has data
  //      (covers the very first pitstop in the session)
  if (currentStint && currentPitstop && hasMinimalData(currentStint, currentPitstop)) {
    const cold = getColdForStint(currentStint) ?? {};
    return {
      stint: currentStint,
      pitstop: currentPitstop,
      coldPressures: cold,
      source: "same-session-similar",
      sameSession: true,
    };
  }

  // ── 3 & 4: Prior sessions (sorted newest-first) ──
  const sorted = [...priorSessions]
    .filter((s) => s.id !== currentSession.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const session of sorted) {
    if (session.trackName.toLowerCase() !== currentSession.trackName.toLowerCase()) {
      continue;
    }

    // Get latest pitstops with data from this session
    const priorCandidates: { stint: Stint, pitstop: PitstopEntry }[] = [];
    for (const stint of session.stints) {
      for (const pitstop of stint.pitstops) {
        if (hasMinimalData(stint, pitstop)) {
          priorCandidates.push({ stint, pitstop });
        }
      }
    }
    priorCandidates.reverse();

    // 3: same track + same target mode
    const sameMode = priorCandidates.find((c) => c.stint.baseline.targetMode === targetMode);
    if (sameMode) {
      const cold = getColdForStint(sameMode.stint) ?? {};
      return {
        stint: sameMode.stint,
        pitstop: sameMode.pitstop,
        coldPressures: cold,
        source: "prior-session-same-track-same-mode",
        sameSession: false,
      };
    }

    // 4: same track, any mode
    if (priorCandidates.length > 0) {
      const best = priorCandidates[0];
      const cold = getColdForStint(best.stint) ?? {};
      return {
        stint: best.stint,
        pitstop: best.pitstop,
        coldPressures: cold,
        source: "prior-session-same-track",
        sameSession: false,
      };
    }
  }

  return undefined;
}

/**
 * A pitstop has minimal data if:
 * - It has hot measured pressures
 * - Cold pressures can be resolved for its stint
 */
function hasMinimalData(stint: Stint, p: PitstopEntry): boolean {
  const hasHot = p.hotMeasuredPressures && Object.keys(p.hotMeasuredPressures).length > 0;
  const cold = getColdForStint(stint);
  const hasCold = cold && Object.keys(cold).length > 0;
  return !!(hasCold && hasHot);
}

// ─── Condition Correction (spec §5.4) ──────────────────────────────

export function computeEffectiveTempDelta(
  refAmbient: number,
  refAsphalt: number,
  refStartTire: number,
  nextAmbient: number,
  nextAsphalt: number,
  nextStartTire: number,
  coefficients: EngineCoefficients
): number {
  // Ambient/asphalt: warmer environment → tire heats MORE → need LESS cold pressure (positive contribution)
  // Tire start temp: warmer tire → LESS temperature rise → need MORE cold pressure (negative contribution)
  // The tire term is SUBTRACTED because it has the OPPOSITE effect of ambient/asphalt:
  //   Higher cold tire temp → smaller heat rise → less pressure gain → need higher cold start
  return (
    (nextAmbient - refAmbient) * coefficients.kAmbient +
    (nextAsphalt - refAsphalt) * coefficients.kTrack -
    (nextStartTire - refStartTire) * 1.0
  );
}

export function computeConditionCorrection(
  effectiveTempDelta: number,
  kTemp: number
): number {
  return effectiveTempDelta * kTemp;
}

// ─── Feedback Correction (spec §5.3) ───────────────────────────────

export function computeFeedbackCorrection(
  targetHot: number,
  measuredHot: number
): number {
  return targetHot - measuredHot;
}

// ─── Carry-over (spec §7 & prompt §E) ──────────────────────────────

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
  if (ref.stint.baseline.targetMode === currentTargetMode) score += 0.15;

  const refAmbient = ref.stint.baseline.ambientMeasured;
  void refAmbient;

  if (
    ref.pitstop.hotCorrectedPressures &&
    Object.keys(ref.pitstop.hotCorrectedPressures).length > 0
  ) {
    score += 0.1;
  }

  const coldKeys = ref.coldPressures ? Object.keys(ref.coldPressures).length : 0;
  if (coldKeys >= 4) score += 0.05;

  return Math.min(1, score);
}

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
  if (ref.stint.baseline.targetMode === currentTargetMode) score += 0.15;

  const refBaseline = getBaselineConditions(ref.stint);
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

  const coldKeys = ref.coldPressures ? Object.keys(ref.coldPressures).length : 0;
  if (coldKeys >= 4) score += 0.05;

  return Math.min(1, score);
}

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

    for (const stint of session.stints) {
      for (const pitstop of stint.pitstops) {
        if (!hasMinimalData(stint, pitstop)) continue;

        const cold = getColdForStint(stint) ?? {};
        const ref: ResolvedReference = {
          stint,
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

        if (conf < 0.3) continue;

        const targets = getEffectiveTargetPerCorner(stint, pitstop);
        const hot = pitstop.hotMeasuredPressures ?? {};
        const residuals: CornerValues = {
          FL: (targets.FL - (hot.FL ?? targets.FL)),
          FR: (targets.FR - (hot.FR ?? targets.FR)),
          RL: (targets.RL - (hot.RL ?? targets.RL)),
          RR: (targets.RR - (hot.RR ?? targets.RR)),
        };

        qualified.push({ residuals, weight: conf * 0.3 });
      }
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
  currentStintId: string;
  currentPitstopId: string;
  nextConditions: NextStintConditions;
  targetMode: TargetMode;
  targets: Targets;
  priorSessions: Session[];
  settings: AppSettings;
  /** Compound type for the next stint — determines kAmbient/kTrack */
  compound?: CompoundType;
}

export function computeRecommendation(
  input: RecommendationInput
): RecommendationOutput {
  const {
    currentSession,
    currentStintId,
    currentPitstopId,
    nextConditions,
    targetMode,
    targets,
    priorSessions,
    settings,
    compound,
  } = input;

  const resolved = resolveCompoundCoefficients(compound, settings);
  const coefficients: EngineCoefficients = {
    kTemp: settings.kTemp,
    kTrack: resolved.kTrack,
    kAmbient: resolved.kAmbient,
  };

  const defaultStartTire = settings.defaultStartTireTemp;
  const targetCorners = expandTargets(targetMode, targets);

  const ref = selectReference(
    currentSession,
    currentStintId,
    currentPitstopId,
    priorSessions,
    targetMode
  );

  if (!ref) {
    return classicFallback(targetCorners, coefficients);
  }

  const refPitstop = ref.pitstop;
  const refStint = ref.stint;
  const refCold = ref.coldPressures;

  const refHotMeasured = refPitstop.hotMeasuredPressures ?? {};
  // Keep refTargetHot for rationale text (describing what happened in the reference stint)
  const refTargetHot = expandTargets(refStint.baseline.targetMode, refStint.baseline.targets);

  const refBaselineConditions = getBaselineConditions(refStint);
  const refAmbient = refBaselineConditions.ambient ?? nextConditions.ambientTemp;
  const refAsphalt = refBaselineConditions.asphalt ?? nextConditions.asphaltTemp;
  const refStartTire = refBaselineConditions.startTireTemps ?? {};

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

  const recommended: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const predicted: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const deltas: CornerValues = { FL: 0, FR: 0, RL: 0, RR: 0 };
  const rationaleLines: string[] = [];

  rationaleLines.push(
    `Using pitstop ${refPitstop.index} from stint '${refStint.name}' as reference (${ref.source.replace(/-/g, " ")}).`
  );

  for (const corner of CORNERS) {
    const rCold = refCold[corner];
    const rHot = refHotMeasured[corner];

    if (rCold == null || rHot == null) {
      recommended[corner] = targetCorners[corner];
      predicted[corner] = targetCorners[corner];
      deltas[corner] = 0;
      continue;
    }

    // Feedback uses the NEW stint's target, not the reference stint's target.
    // This matches the Excel formula: nextCold = TARGET - (predictedTemp - nextTire) * kTemp
    // which expands to: refCold + (newTarget - refHot) - condCorr
    // When target changes between stints, this correctly shifts cold pressure.
    const feedback = computeFeedbackCorrection(targetCorners[corner], rHot);
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

    const coCorr = carryOver.biasPerCorner[corner] ?? 0;
    const nextCold = rCold + feedback - condCorr + coCorr;
    recommended[corner] = round(nextCold, 3);
    // Predicted hot = what hot pressure we expect the recommended cold to produce
    // Using the relationship: predictedHot = recommendedCold + (refHot - refCold) + condCorr
    const hotRise = rHot - rCold; // observed pressure rise from cold→hot on reference
    predicted[corner] = round(nextCold + hotRise + condCorr, 3);
    deltas[corner] = round(predicted[corner] - targetCorners[corner], 3);
  }

  const refHotFL = refHotMeasured.FL;
  const refTargetFL = refTargetHot.FL;
  if (refHotFL != null && refTargetFL != null) {
    const diff = round(refHotFL - refTargetFL, 3);
    if (diff > 0) {
      rationaleLines.push(`Car came in ${Math.abs(diff)} bar high (ref target ${refTargetFL}).`);
    } else if (diff < 0) {
      rationaleLines.push(`Car came in ${Math.abs(diff)} bar low (ref target ${refTargetFL}).`);
    } else {
      rationaleLines.push(`Car came in on target (${refTargetFL}).`);
    }
  }

  // Note if target changed between stints
  const newTargetFL = targetCorners.FL;
  if (refTargetFL != null && newTargetFL !== refTargetFL) {
    const tDiff = round(newTargetFL - refTargetFL, 3);
    rationaleLines.push(
      `Target changed ${tDiff > 0 ? "+" : ""}${tDiff} bar (${refTargetFL} → ${newTargetFL}).`
    );
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

  const confidence = computeCarryOverConfidence(
    ref,
    targetMode,
    nextConditions.ambientTemp,
    currentSession.trackName,
    currentSession.trackName
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
