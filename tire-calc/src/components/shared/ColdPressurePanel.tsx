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

interface ColdPressurePanelProps {
  /** Pre-computed recommendation (from latest pitstop data) */
  recommendation: RecommendationOutput | null;
  /** Pressure display unit */
  pressureUnit: string;
  /** Temperature display unit */
  temperatureUnit: string;
  /** Description of conditions used */
  conditionsLabel?: string;
  /** Threshold below which cold pressure shows a red warning (bar) */
  minColdPressureBar?: number;
  /** Whether the calculator section is collapsible (planner mode) */
  collapsible?: boolean;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  /** Event for inline recalculation */
  event?: Event | null;
  /** App settings */
  settings?: AppSettings;
  /** Current weather conditions from API */
  currentConditions?: { ambient: number; asphalt: number } | null;
  /** Get forecast at arbitrary time */
  getForecastAtTime?: (time: Date) => { ambient: number; asphalt: number } | null;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

// ─── Component ─────────────────────────────────────────────────────

export function ColdPressurePanel({
  recommendation,
  pressureUnit,
  temperatureUnit,
  conditionsLabel,
  minColdPressureBar = 1.3,
  collapsible = false,
  defaultCollapsed = true,
  event,
  settings,
  currentConditions,
  getForecastAtTime,
}: ColdPressurePanelProps) {
  const [calcOpen, setCalcOpen] = useState(!defaultCollapsed);
  const [calcAmbient, setCalcAmbient] = useState<number | undefined>(undefined);
  const [calcAsphalt, setCalcAsphalt] = useState<number | undefined>(undefined);
  const [calcTireTemps, setCalcTireTemps] = useState<PartialCornerValues>({});
  const [calcPredTime, setCalcPredTime] = useState("");

  const latestStint = event?.stints?.[event.stints.length - 1];

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

  // Compute inline calculator recommendation
  const calcRecommendation: RecommendationOutput | null = useMemo(() => {
    if (!event || !settings || !latestStint) return null;
    if (!latestStint.pitstops || latestStint.pitstops.length === 0) return null;
    const latestPitstop = latestStint.pitstops[latestStint.pitstops.length - 1];

    // Only compute if user has entered at least one override
    const hasOverride = calcAmbient != null || calcAsphalt != null || Object.keys(calcTireTemps).length > 0;
    if (!hasOverride) return null;

    const amb = calcAmbient ?? currentConditions?.ambient ?? latestStint.baseline?.ambientMeasured ?? 20;
    const asp = calcAsphalt ?? currentConditions?.asphalt ?? latestStint.baseline?.asphaltMeasured ?? 30;
    const tireTemps = Object.keys(calcTireTemps).length > 0 ? calcTireTemps : latestStint.baseline?.startTireTemps;

    const input: RecommendationInput = {
      currentEvent: event,
      currentStintId: latestStint.id,
      currentPitstopId: latestPitstop.id,
      nextConditions: { ambientTemp: amb, asphaltTemp: asp, startTireTemps: tireTemps },
      targetMode: latestStint.baseline?.targetMode ?? "single",
      targets: latestStint.baseline?.targets ?? {},
      priorEvents: [],
      settings,
      compound: latestStint.baseline?.compound,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [event, settings, latestStint, calcAmbient, calcAsphalt, calcTireTemps, currentConditions]);

  // The recommendation to display in the header (calc override or default)
  const displayRec = calcRecommendation ?? recommendation;

  return (
    <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl overflow-hidden">
      {/* ── Result header ── */}
      <div className="p-5">
        {!displayRec ? (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Cold Pressure Recommendation
            </h3>
            <p className="text-sm text-gray-500">
              Complete a stint with pitstop data to see recommended cold pressures.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {calcRecommendation ? "Recalculated Cold Pressures" : "Recommended Cold Pressures"}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">
                  {(displayRec.confidenceScore * 100).toFixed(0)}%
                </span>
                <div className="w-10 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${displayRec.confidenceScore * 100}%`,
                      backgroundColor:
                        displayRec.confidenceScore > 0.6
                          ? "#00d4aa"
                          : displayRec.confidenceScore > 0.3
                          ? "#EAB308"
                          : "#EF4444",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 4-corner pressures */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {CORNERS.map((c) => {
                const cold = displayRec.recommendedColdPressures[c];
                const delta = displayRec.deltasToTarget[c];
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
              (c) => displayRec.recommendedColdPressures[c] < minColdPressureBar
            ) && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-2 mb-3 text-xs text-red-300 text-center font-medium">
                ⚠ One or more cold pressures are below{" "}
                {minColdPressureBar.toFixed(1)} bar
              </div>
            )}

            {/* Rationale */}
            <p className="text-xs text-gray-400 leading-relaxed mb-2">
              {displayRec.rationaleText}
            </p>

            {conditionsLabel && (
              <p className="text-[10px] text-gray-500">{conditionsLabel}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-700/40 text-[10px] text-gray-500">
              <span>Ref: {displayRec.referenceSource.replace(/-/g, " ")}</span>
              <span>
                kT={displayRec.coefficientsUsed.kTemp} kTr=
                {displayRec.coefficientsUsed.kTrack} kA=
                {displayRec.coefficientsUsed.kAmbient}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Calculator section ── */}
      {event && settings && latestStint && latestStint.pitstops?.length > 0 && (
        <>
          {collapsible ? (
            <button
              className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-400 hover:bg-gray-700/30 transition-colors border-t border-gray-700/40 uppercase tracking-wide"
              onClick={() => setCalcOpen((v) => !v)}
            >
              What-if Calculator
              <span className="text-gray-500 text-sm">{calcOpen ? "▲" : "▼"}</span>
            </button>
          ) : (
            <div className="px-5 py-2.5 text-xs font-medium text-gray-400 border-t border-gray-700/40 uppercase tracking-wide">
              What-if Calculator
            </div>
          )}

          {(!collapsible || calcOpen) && (
            <div className="px-5 pb-5 space-y-4">
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

              {/* Conditions inputs */}
              <div className="grid grid-cols-2 gap-3">
                <NumericInput
                  label="Ambient Temp"
                  unit={`°${temperatureUnit}`}
                  value={calcAmbient}
                  onChange={setCalcAmbient}
                  placeholder={currentConditions?.ambient?.toString()}
                />
                <NumericInput
                  label="Asphalt Temp"
                  unit={`°${temperatureUnit}`}
                  value={calcAsphalt}
                  onChange={setCalcAsphalt}
                  placeholder={currentConditions?.asphalt?.toString()}
                />
              </div>

              {/* Cold Tire Temps */}
              <div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">
                  Cold Tire Temperatures
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {CORNERS.map((c) => (
                    <NumericInput
                      key={c}
                      label={c}
                      unit={`°${temperatureUnit}`}
                      value={calcTireTemps[c]}
                      onChange={(v) => setCalcTireTemps((prev) => ({ ...prev, [c]: v }))}
                      placeholder={latestStint?.baseline?.startTireTemps?.[c]?.toString()}
                    />
                  ))}
                </div>
              </div>

              {/* Result */}
              {calcRecommendation && (
                <div className="p-3 bg-teal-900/20 border border-teal-700/30 rounded-lg">
                  <div className="text-[10px] text-teal-400 uppercase tracking-wide mb-2 font-medium">
                    Recalculated Pressures
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {CORNERS.map((c) => {
                      const cold = calcRecommendation.recommendedColdPressures[c];
                      const isBelowMin = cold < minColdPressureBar;
                      return (
                        <div key={c} className="text-center">
                          <div className="text-[10px] text-gray-500">{c}</div>
                          <div
                            className={`text-lg font-bold tabular-nums ${
                              isBelowMin ? "text-red-400" : "text-teal-400"
                            }`}
                          >
                            {cold.toFixed(2)}
                          </div>
                          {isBelowMin && (
                            <div className="text-[10px] text-red-400">⚠ Low</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
