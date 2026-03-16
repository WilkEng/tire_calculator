"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  RecommendationOutput,
  Corner,
  PartialCornerValues,
  AppSettings,
  Event,
  TargetMode,
  Targets,
} from "@/lib/domain/models";
import { computeRecommendation, resolveMinColdPressure, type RecommendationInput } from "@/lib/engine";
import { BUILT_IN_COMPOUNDS } from "@/lib/domain/models";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { displayPressure, displayTemp, displayKTemp, inputPressure, inputTemp, pressureDecimals, kTempDecimals } from "@/lib/utils/helpers";

// ─── Types ─────────────────────────────────────────────────────────

interface QuickCalculatorProps {
  /** Pressure display unit */
  pressureUnit: string;
  /** Temperature display unit */
  temperatureUnit: string;
  /** Event to source baseline data from */
  event?: Event | null;
  /** App settings */
  settings?: AppSettings;
  /** Current weather conditions from API */
  currentConditions?: { ambient: number; asphalt: number } | null;
  /** Get forecast at arbitrary time */
  getForecastAtTime?: (time: Date) => { ambient: number; asphalt: number } | null;
  /** Which stint to use as reference (defaults to latest with pitstop data) */
  referenceStintId?: string;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

const TARGET_MODE_OPTIONS = [
  { value: "single", label: "Single Target" },
  { value: "front-rear", label: "Front / Rear" },
  { value: "four-corner", label: "Four Corner" },
];

// ─── Component ─────────────────────────────────────────────────────

export function QuickCalculator({
  pressureUnit,
  temperatureUnit,
  event,
  settings,
  currentConditions,
  getForecastAtTime,
  referenceStintId,
}: QuickCalculatorProps) {
  const [expanded, setExpanded] = useState(false);
  const [calcAmbient, setCalcAmbient] = useState<number | undefined>(undefined);
  const [calcAsphalt, setCalcAsphalt] = useState<number | undefined>(undefined);
  const [calcTireTemps, setCalcTireTemps] = useState<PartialCornerValues>({});
  const [calcPredTime, setCalcPredTime] = useState("");
  const [compoundOverride, setCompoundOverride] = useState<string | null>(null);
  const [targetModeOverride, setTargetModeOverride] = useState<TargetMode | null>(null);
  const [targetsOverride, setTargetsOverride] = useState<Targets | null>(null);

  // Find reference stint (explicit or latest with pitstop data)
  const refStint = useMemo(() => {
    if (!event?.stints) return null;
    if (referenceStintId) {
      return event.stints.find((s) => s.id === referenceStintId) ?? null;
    }
    // Walk backwards to find latest stint with pitstop data
    for (let i = event.stints.length - 1; i >= 0; i--) {
      if (event.stints[i].pitstops?.length > 0) return event.stints[i];
    }
    return null;
  }, [event, referenceStintId]);

  const latestPitstop = refStint?.pitstops?.[refStint.pitstops.length - 1] ?? null;

  // Compound: user override → baseline → "medium"
  const baselineCompound = refStint?.baseline?.compound ?? "medium";
  const selectedCompound = compoundOverride ?? baselineCompound;
  const minColdPressureBar = settings
    ? resolveMinColdPressure(selectedCompound, settings)
    : 1.3;

  // Build compound options (built-in + custom)
  const compoundOptions = useMemo(() => [
    ...BUILT_IN_COMPOUNDS.map((c) => ({
      value: c,
      label: c.charAt(0).toUpperCase() + c.slice(1),
    })),
    ...(settings?.customCompounds ?? []).map((c) => ({
      value: c.id,
      label: c.name || `Custom (${c.id.slice(0, 6)})`,
    })),
  ], [settings?.customCompounds]);

  // Target: user override → baseline
  const baselineTargetMode = refStint?.baseline?.targetMode ?? "single";
  const baselineTargets = refStint?.baseline?.targets ?? {};
  const selectedTargetMode = targetModeOverride ?? baselineTargetMode;
  const selectedTargets = targetsOverride ?? baselineTargets;

  // Handle prediction fill
  const handleUsePrediction = useCallback(
    (timeStr?: string) => {
      if (!getForecastAtTime) return;
      let time: Date;
      if (timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        time = new Date();
        time.setHours(h, m, 0, 0);
      } else {
        time = new Date();
      }
      const forecast = getForecastAtTime(time);
      if (forecast) {
        setCalcAmbient(forecast.ambient);
        setCalcAsphalt(forecast.asphalt);
      }
    },
    [getForecastAtTime]
  );

  // Only compute when user has provided the necessary temperature inputs
  const hasRequiredInputs = calcAmbient != null && calcAsphalt != null;

  // Compute recommendation
  const result: RecommendationOutput | null = useMemo(() => {
    if (!event || !settings || !refStint || !latestPitstop) return null;
    if (!hasRequiredInputs) return null;

    const tireTemps = Object.keys(calcTireTemps).length > 0
      ? calcTireTemps
      : refStint.baseline?.startTireTemps;

    const input: RecommendationInput = {
      currentEvent: event,
      currentStintId: refStint.id,
      currentPitstopId: latestPitstop.id,
      nextConditions: {
        ambientTemp: calcAmbient!,
        asphaltTemp: calcAsphalt!,
        startTireTemps: tireTemps,
      },
      targetMode: selectedTargetMode,
      targets: selectedTargets,
      priorEvents: [],
      settings,
      compound: selectedCompound,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [event, settings, refStint, latestPitstop, hasRequiredInputs, calcAmbient, calcAsphalt, calcTireTemps, selectedCompound, selectedTargetMode, selectedTargets]);

  // Can we compute at all? Need event + stint with pitstop data
  const canCompute = !!event && !!refStint && !!latestPitstop && !!settings;

  return (
    <div className="bg-gray-900/90 border border-gray-600/70 rounded-xl overflow-hidden shadow-lg shadow-black/20">
      {/* ── Collapsed header (always visible) ── */}
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-800/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
            Quick Calculator
          </h3>
          {result && !expanded && (
            <span className="text-xs text-[#00d4aa] font-semibold">
              — {CORNERS.map((c) => displayPressure(result.recommendedColdPressures[c], pressureUnit).toFixed(pressureDecimals(pressureUnit))).join(" / ")} {pressureUnit}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/50 space-y-4 pt-4">
          {!canCompute ? (
            <p className="text-sm text-gray-400">
              Load an event with pitstop data to use the quick calculator.
            </p>
          ) : (
            <>
              {/* Reference info */}
              <div className="text-[11px] text-gray-400">
                Based on <span className="text-gray-200 font-medium">{refStint.name}</span>
              </div>

              {/* Compound selector */}
              <div className="max-w-48">
                <Select
                  label="Compound"
                  value={selectedCompound}
                  onChange={(v) => setCompoundOverride(v)}
                  options={compoundOptions}
                />
              </div>

              {/* Target hot pressure */}
              <div>
                <div className="text-[11px] text-gray-300 font-medium uppercase tracking-wide mb-2">
                  Target Hot Pressure
                </div>
                <div className="space-y-3">
                  <Select
                    label="Target Mode"
                    value={selectedTargetMode}
                    onChange={(v) => {
                      setTargetModeOverride(v as TargetMode);
                      // Reset targets when mode changes so we don't carry stale values
                      setTargetsOverride(null);
                    }}
                    options={TARGET_MODE_OPTIONS}
                  />

                  {selectedTargetMode === "single" && (
                    <NumericInput
                      label="Target Hot"
                      unit={pressureUnit}
                      value={selectedTargets.singleTargetHotPressure != null ? displayPressure(selectedTargets.singleTargetHotPressure, pressureUnit) : undefined}
                      onChange={(v) =>
                        setTargetsOverride((prev) => ({
                          ...(prev ?? baselineTargets),
                          singleTargetHotPressure: v != null ? inputPressure(v, pressureUnit) : v,
                        }))
                      }
                      placeholder={baselineTargets.singleTargetHotPressure != null ? displayPressure(baselineTargets.singleTargetHotPressure, pressureUnit).toFixed(pressureDecimals(pressureUnit)) : undefined}
                    />
                  )}

                  {selectedTargetMode === "front-rear" && (
                    <div className="grid grid-cols-2 gap-3">
                      <NumericInput
                        label="Front Target"
                        unit={pressureUnit}
                        value={selectedTargets.frontTargetHotPressure != null ? displayPressure(selectedTargets.frontTargetHotPressure, pressureUnit) : undefined}
                        onChange={(v) =>
                          setTargetsOverride((prev) => ({
                            ...(prev ?? baselineTargets),
                            frontTargetHotPressure: v != null ? inputPressure(v, pressureUnit) : v,
                          }))
                        }
                        placeholder={baselineTargets.frontTargetHotPressure != null ? displayPressure(baselineTargets.frontTargetHotPressure, pressureUnit).toFixed(pressureDecimals(pressureUnit)) : undefined}
                      />
                      <NumericInput
                        label="Rear Target"
                        unit={pressureUnit}
                        value={selectedTargets.rearTargetHotPressure != null ? displayPressure(selectedTargets.rearTargetHotPressure, pressureUnit) : undefined}
                        onChange={(v) =>
                          setTargetsOverride((prev) => ({
                            ...(prev ?? baselineTargets),
                            rearTargetHotPressure: v != null ? inputPressure(v, pressureUnit) : v,
                          }))
                        }
                        placeholder={baselineTargets.rearTargetHotPressure != null ? displayPressure(baselineTargets.rearTargetHotPressure, pressureUnit).toFixed(pressureDecimals(pressureUnit)) : undefined}
                      />
                    </div>
                  )}

                  {selectedTargetMode === "four-corner" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {CORNERS.map((c) => (
                        <NumericInput
                          key={c}
                          label={`${c} Target`}
                          unit={pressureUnit}
                          value={selectedTargets.cornerTargets?.[c] != null ? displayPressure(selectedTargets.cornerTargets[c]!, pressureUnit) : undefined}
                          onChange={(v) =>
                            setTargetsOverride((prev) => {
                              const current = (prev ?? baselineTargets).cornerTargets ?? { FL: 0, FR: 0, RL: 0, RR: 0 };
                              return {
                                ...(prev ?? baselineTargets),
                                cornerTargets: { ...current, [c]: v != null ? inputPressure(v, pressureUnit) : 0 },
                              };
                            })
                          }
                          placeholder={baselineTargets.cornerTargets?.[c] != null ? displayPressure(baselineTargets.cornerTargets[c]!, pressureUnit).toFixed(pressureDecimals(pressureUnit)) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Prediction picker */}
              {getForecastAtTime && (
                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-gray-800/80 border border-gray-700/50 rounded-lg">
                  <Button variant="secondary" size="sm" onClick={() => handleUsePrediction()}>
                    🌤 Use Current Prediction
                  </Button>
                  <span className="text-[11px] text-gray-400">or at:</span>
                  <input
                    type="time"
                    value={calcPredTime}
                    onChange={(e) => setCalcPredTime(e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-sm text-gray-200 w-28"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUsePrediction(calcPredTime || undefined)}
                    disabled={!calcPredTime}
                  >
                    Apply
                  </Button>
                </div>
              )}

              {/* Required conditions inputs */}
              <div className="grid grid-cols-2 gap-3">
                <NumericInput
                  label="Ambient Temp *"
                  unit={`°${temperatureUnit}`}
                  value={calcAmbient != null ? displayTemp(calcAmbient, temperatureUnit) : undefined}
                  onChange={(v) => setCalcAmbient(v != null ? inputTemp(v, temperatureUnit) : undefined)}
                  placeholder={currentConditions?.ambient != null ? displayTemp(currentConditions.ambient, temperatureUnit).toFixed(1) : "—"}
                />
                <NumericInput
                  label="Asphalt Temp *"
                  unit={`°${temperatureUnit}`}
                  value={calcAsphalt != null ? displayTemp(calcAsphalt, temperatureUnit) : undefined}
                  onChange={(v) => setCalcAsphalt(v != null ? inputTemp(v, temperatureUnit) : undefined)}
                  placeholder={currentConditions?.asphalt != null ? displayTemp(currentConditions.asphalt, temperatureUnit).toFixed(1) : "—"}
                />
              </div>

              {/* Optional cold tire temps */}
              <div>
                <div className="text-[11px] text-gray-300 font-medium uppercase tracking-wide mb-2">
                  Cold Tire Temperatures <span className="text-gray-500">(optional)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CORNERS.map((c) => (
                    <NumericInput
                      key={c}
                      label={c}
                      unit={`°${temperatureUnit}`}
                      value={calcTireTemps[c] != null ? displayTemp(calcTireTemps[c]!, temperatureUnit) : undefined}
                      onChange={(v) => setCalcTireTemps((prev) => ({ ...prev, [c]: v != null ? inputTemp(v, temperatureUnit) : v }))}
                      placeholder={refStint.baseline?.startTireTemps?.[c] != null ? displayTemp(refStint.baseline.startTireTemps[c]!, temperatureUnit).toFixed(1) : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* Result */}
              {!hasRequiredInputs && (
                <p className="text-xs text-gray-400 italic">
                  Enter ambient and asphalt temperatures to calculate pressures.
                </p>
              )}

              {result && (
                <div className="p-3 bg-[#00d4aa]/10 border border-[#00d4aa]/25 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-[#00d4aa] uppercase tracking-wide font-semibold">
                      Recommended Cold Pressures
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-300 font-medium">
                        {(result.confidenceScore * 100).toFixed(0)}%
                      </span>
                      <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${result.confidenceScore * 100}%`,
                            backgroundColor:
                              result.confidenceScore > 0.6
                                ? "#00d4aa"
                                : result.confidenceScore > 0.3
                                ? "#EAB308"
                                : "#EF4444",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CORNERS.map((c) => {
                      const cold = result.recommendedColdPressures[c];
                      const delta = result.deltasToTarget[c];
                      const isBelowMin = cold < minColdPressureBar;
                      const pd = pressureDecimals(pressureUnit);
                      return (
                        <div key={c} className="text-center">
                          <div className="text-[11px] text-gray-400 mb-1 font-semibold">{c}</div>
                          <div
                            className={`text-2xl font-bold tabular-nums leading-tight ${
                              isBelowMin ? "text-red-400" : "text-[#00d4aa]"
                            }`}
                          >
                            {displayPressure(cold, pressureUnit).toFixed(pd)}
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{pressureUnit}</div>
                          {isBelowMin && (
                            <div className="text-[10px] text-red-400 font-medium mt-0.5">
                              ⚠ Below {displayPressure(minColdPressureBar, pressureUnit).toFixed(pd)}
                            </div>
                          )}
                          <div
                            className={`text-[11px] mt-1 tabular-nums font-medium ${
                              Math.abs(delta) < 0.005
                                ? "text-[#00d4aa]"
                                : delta > 0
                                ? "text-yellow-300"
                                : "text-orange-300"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {displayPressure(delta, pressureUnit).toFixed(pd)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Low pressure warning */}
                  {CORNERS.some(
                    (c) => result.recommendedColdPressures[c] < minColdPressureBar
                  ) && (
                    <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-2 mt-3 text-xs text-red-300 text-center font-medium">
                      ⚠ One or more cold pressures are below{" "}
                      {displayPressure(minColdPressureBar, pressureUnit).toFixed(pressureDecimals(pressureUnit))} {pressureUnit}
                    </div>
                  )}

                  {/* Rationale */}
                  <p className="text-xs text-gray-300 leading-relaxed mt-3">
                    {result.rationaleText}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-700/50 text-[11px] text-gray-400">
                    <span>Ref: {result.referenceSource.replace(/-/g, " ")}</span>
                    <span>
                      kT={displayKTemp(result.coefficientsUsed.kTemp, pressureUnit, temperatureUnit).toFixed(kTempDecimals(pressureUnit))} kTr=
                      {result.coefficientsUsed.kTrack} kA=
                      {result.coefficientsUsed.kAmbient}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
