"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  RecommendationOutput,
  Corner,
  PartialCornerValues,
  AppSettings,
  Event,
} from "@/lib/domain/models";
import { computeRecommendation, type RecommendationInput } from "@/lib/engine";
import { NumericInput } from "@/components/ui/NumericInput";
import { Button } from "@/components/ui/Button";

// ─── Types ─────────────────────────────────────────────────────────

interface QuickCalculatorProps {
  /** Pressure display unit */
  pressureUnit: string;
  /** Temperature display unit */
  temperatureUnit: string;
  /** Threshold below which cold pressure shows a red warning (bar) */
  minColdPressureBar?: number;
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

// ─── Component ─────────────────────────────────────────────────────

export function QuickCalculator({
  pressureUnit,
  temperatureUnit,
  minColdPressureBar = 1.3,
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
      targetMode: refStint.baseline?.targetMode ?? "single",
      targets: refStint.baseline?.targets ?? {},
      priorEvents: [],
      settings,
      compound: refStint.baseline?.compound,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [event, settings, refStint, latestPitstop, hasRequiredInputs, calcAmbient, calcAsphalt, calcTireTemps]);

  // Can we compute at all? Need event + stint with pitstop data
  const canCompute = !!event && !!refStint && !!latestPitstop && !!settings;

  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl overflow-hidden">
      {/* ── Collapsed header (always visible) ── */}
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-700/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Quick Calculator
          </h3>
          {result && !expanded && (
            <span className="text-[10px] text-teal-400 font-medium">
              — {CORNERS.map((c) => result.recommendedColdPressures[c].toFixed(2)).join(" / ")} {pressureUnit}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-sm">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-700/40 space-y-4 pt-4">
          {!canCompute ? (
            <p className="text-sm text-gray-500">
              Load an event with pitstop data to use the quick calculator.
            </p>
          ) : (
            <>
              {/* Reference info */}
              <div className="text-[10px] text-gray-500">
                Based on <span className="text-gray-300">{refStint.name}</span>
                {refStint.baseline?.compound && (
                  <> · {refStint.baseline.compound}</>
                )}
              </div>

              {/* Prediction picker */}
              {getForecastAtTime && (
                <div className="flex items-center gap-2 p-2 bg-gray-700/30 rounded-lg">
                  <Button variant="secondary" size="sm" onClick={() => handleUsePrediction()}>
                    🌤 Now
                  </Button>
                  <span className="text-[10px] text-gray-500">or at:</span>
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
                  value={calcAmbient}
                  onChange={setCalcAmbient}
                  placeholder={currentConditions?.ambient?.toFixed(1) ?? "—"}
                />
                <NumericInput
                  label="Asphalt Temp *"
                  unit={`°${temperatureUnit}`}
                  value={calcAsphalt}
                  onChange={setCalcAsphalt}
                  placeholder={currentConditions?.asphalt?.toFixed(1) ?? "—"}
                />
              </div>

              {/* Optional cold tire temps */}
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">
                  Cold Tire Temperatures <span className="text-gray-600">(optional)</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {CORNERS.map((c) => (
                    <NumericInput
                      key={c}
                      label={c}
                      unit={`°${temperatureUnit}`}
                      value={calcTireTemps[c]}
                      onChange={(v) => setCalcTireTemps((prev) => ({ ...prev, [c]: v }))}
                      placeholder={refStint.baseline?.startTireTemps?.[c]?.toString()}
                    />
                  ))}
                </div>
              </div>

              {/* Result */}
              {!hasRequiredInputs && (
                <p className="text-xs text-gray-500 italic">
                  Enter ambient and asphalt temperatures to calculate pressures.
                </p>
              )}

              {result && (
                <div className="p-3 bg-teal-900/20 border border-teal-700/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-teal-400 uppercase tracking-wide font-medium">
                      Recommended Cold Pressures
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">
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
                  <div className="grid grid-cols-4 gap-3">
                    {CORNERS.map((c) => {
                      const cold = result.recommendedColdPressures[c];
                      const delta = result.deltasToTarget[c];
                      const isBelowMin = cold < minColdPressureBar;
                      return (
                        <div key={c} className="text-center">
                          <div className="text-[10px] text-gray-500 mb-1 font-medium">{c}</div>
                          <div
                            className={`text-2xl font-bold tabular-nums leading-tight ${
                              isBelowMin ? "text-red-400" : "text-teal-400"
                            }`}
                          >
                            {cold.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{pressureUnit}</div>
                          {isBelowMin && (
                            <div className="text-[10px] text-red-400 font-medium mt-0.5">
                              ⚠ Below {minColdPressureBar.toFixed(1)}
                            </div>
                          )}
                          <div
                            className={`text-[10px] mt-1 tabular-nums ${
                              Math.abs(delta) < 0.005
                                ? "text-teal-400"
                                : delta > 0
                                ? "text-yellow-400"
                                : "text-orange-400"
                            }`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta.toFixed(2)}
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
                      {minColdPressureBar.toFixed(1)} bar
                    </div>
                  )}

                  {/* Rationale */}
                  <p className="text-xs text-gray-400 leading-relaxed mt-3">
                    {result.rationaleText}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-700/40 text-[10px] text-gray-500">
                    <span>Ref: {result.referenceSource.replace(/-/g, " ")}</span>
                    <span>
                      kT={result.coefficientsUsed.kTemp} kTr=
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
