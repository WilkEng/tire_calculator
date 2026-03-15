export {
  computeRecommendation,
  computeFeedbackCorrection,
  computeConditionCorrection,
  computeEffectiveTempDelta,
  computeCarryOverBias,
  computeCarryOverConfidence,
  selectReference,
  expandTargets,
  getEffectiveTargetPerCorner,
} from "./pressureEngine";

export type {
  RecommendationInput,
  NextStintConditions,
  EngineCoefficients,
  ResolvedReference,
  CarryOverBias,
} from "./pressureEngine";
