"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import type {
  StintBaseline,
  TargetMode,
  Corner,
  Stint,
  CompoundType,
} from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

interface StintStartFlowProps {
  /** Current stint being configured */
  stint: Stint;
  /** Pressure unit for display */
  pressureUnit: string;
  /** Temperature unit for display */
  temperatureUnit: string;
  /** Whether this is the first stint (only first stint can import) */
  isFirstStint: boolean;
  /** Whether the baseline was imported (read-only mode) */
  isImported: boolean;
  /** Recommended cold pressures from the engine (if available from prior stint) */
  recommendedColdPressures?: { FL?: number; FR?: number; RL?: number; RR?: number };
  /** Current weather conditions (from API/hook) */
  weatherConditions?: { ambient: number; asphalt: number };
  /** Get weather prediction at a given time */
  getForecastAtTime?: (time: Date) => { ambient: number; asphalt: number } | null;
  /** Callback when baseline fields change */
  onBaselineUpdate: (updates: Partial<StintBaseline>) => void;
  /** Callback to handle file import */
  onImportBaseline: (file: File) => void;
  /** Callback to pick a baseline from history */
  onPickFromHistory: () => void;
  /** Callback when user changes ambient/asphalt (for recording overrides) */
  onWeatherOverride?: (field: "ambient" | "asphalt", value: number) => void;
}

// ─── Constants ─────────────────────────────────────────────────────

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

const TARGET_MODE_OPTIONS = [
  { value: "single", label: "Single Target" },
  { value: "front-rear", label: "Front / Rear" },
  { value: "four-corner", label: "Four Corner" },
];

// ─── Component ─────────────────────────────────────────────────────

export function StintStartFlow({
  stint,
  pressureUnit,
  temperatureUnit,
  isFirstStint,
  isImported,
  recommendedColdPressures,
  weatherConditions,
  getForecastAtTime,
  onBaselineUpdate,
  onImportBaseline,
  onPickFromHistory,
  onWeatherOverride,
}: StintStartFlowProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "import">(
    isImported ? "import" : "manual"
  );
  const [predictionTime, setPredictionTime] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseline = stint.baseline;

  // ─── Cold Pressure Handlers ────────────────────────────────────

  const handleColdPressure = useCallback(
    (corner: Corner, value: number | undefined) => {
      onBaselineUpdate({
        coldPressures: { ...baseline.coldPressures, [corner]: value },
      });
    },
    [baseline.coldPressures, onBaselineUpdate]
  );

  const handleStartTireTemp = useCallback(
    (corner: Corner, value: number | undefined) => {
      onBaselineUpdate({
        startTireTemps: { ...baseline.startTireTemps, [corner]: value },
      });
    },
    [baseline.startTireTemps, onBaselineUpdate]
  );

  // ─── Target Handlers ──────────────────────────────────────────

  const handleTargetModeChange = useCallback(
    (mode: string) => {
      onBaselineUpdate({ targetMode: mode as TargetMode });
    },
    [onBaselineUpdate]
  );

  const handleSingleTarget = useCallback(
    (value: number | undefined) => {
      onBaselineUpdate({
        targets: { ...baseline.targets, singleTargetHotPressure: value },
      });
    },
    [baseline.targets, onBaselineUpdate]
  );

  const handleFrontTarget = useCallback(
    (value: number | undefined) => {
      onBaselineUpdate({
        targets: { ...baseline.targets, frontTargetHotPressure: value },
      });
    },
    [baseline.targets, onBaselineUpdate]
  );

  const handleRearTarget = useCallback(
    (value: number | undefined) => {
      onBaselineUpdate({
        targets: { ...baseline.targets, rearTargetHotPressure: value },
      });
    },
    [baseline.targets, onBaselineUpdate]
  );

  const handleCornerTarget = useCallback(
    (corner: Corner, value: number | undefined) => {
      const current = baseline.targets.cornerTargets ?? { FL: 0, FR: 0, RL: 0, RR: 0 };
      onBaselineUpdate({
        targets: {
          ...baseline.targets,
          cornerTargets: { ...current, [corner]: value ?? 0 },
        },
      });
    },
    [baseline.targets, onBaselineUpdate]
  );

  // ─── Condition Handlers ────────────────────────────────────────

  const handleAmbientChange = useCallback(
    (value: number | undefined) => {
      onBaselineUpdate({ ambientMeasured: value });
      if (value != null && onWeatherOverride) {
        onWeatherOverride("ambient", value);
      }
    },
    [onBaselineUpdate, onWeatherOverride]
  );

  const handleAsphaltChange = useCallback(
    (value: number | undefined) => {
      onBaselineUpdate({ asphaltMeasured: value });
      if (value != null && onWeatherOverride) {
        onWeatherOverride("asphalt", value);
      }
    },
    [onBaselineUpdate, onWeatherOverride]
  );

  // ─── Use weather prediction ────────────────────────────────────

  const handleUsePrediction = useCallback(
    (timeStr?: string) => {
      if (!getForecastAtTime) return;
      let time: Date;
      if (timeStr) {
        // Parse HH:MM into today's date
        const [h, m] = timeStr.split(":").map(Number);
        time = new Date();
        time.setHours(h, m, 0, 0);
      } else {
        time = new Date();
      }
      const forecast = getForecastAtTime(time);
      if (forecast) {
        onBaselineUpdate({
          ambientMeasured: forecast.ambient,
          asphaltMeasured: forecast.asphalt,
        });
        if (onWeatherOverride) {
          onWeatherOverride("ambient", forecast.ambient);
          onWeatherOverride("asphalt", forecast.asphalt);
        }
      }
    },
    [getForecastAtTime, onBaselineUpdate, onWeatherOverride]
  );

  // ─── Apply recommended cold pressures ──────────────────────────

  const handleApplyRecommended = useCallback(() => {
    if (recommendedColdPressures) {
      onBaselineUpdate({ coldPressures: { ...recommendedColdPressures } });
    }
  }, [recommendedColdPressures, onBaselineUpdate]);

  // ─── File import ───────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImportBaseline(file);
    },
    [onImportBaseline]
  );

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      {/* Tab Header — only show Import tab for first stint */}
      {isFirstStint ? (
        <div className="flex border-b border-gray-700">
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "manual"
                ? "bg-gray-700 text-teal-400 border-b-2 border-teal-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-750"
            }`}
            onClick={() => setActiveTab("manual")}
          >
            Manual Baseline
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "import"
                ? "bg-gray-700 text-teal-400 border-b-2 border-teal-400"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-750"
            }`}
            onClick={() => setActiveTab("import")}
          >
            Import Baseline
          </button>
        </div>
      ) : (
        <div className="flex border-b border-gray-700">
          <div className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-700 text-teal-400 border-b-2 border-teal-400">
            Stint Setup (based on previous stint)
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {activeTab === "import" && isFirstStint ? (
          /* ──── Import Tab ──── */
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Import a baseline from a previously exported stint or pick from an existing session.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Upload JSON File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button variant="secondary" onClick={onPickFromHistory}>
                📋 Pick from History
              </Button>
            </div>

            {isImported && stint.importedBaseline && (
              <div className="bg-teal-900/20 border border-teal-700/50 rounded p-3 text-sm text-teal-300">
                <span className="font-medium">Imported baseline</span>
                {stint.importedBaseline.sourceSessionName && (
                  <span className="text-teal-400">
                    {" "}from {stint.importedBaseline.sourceSessionName}
                    {stint.importedBaseline.sourceStintName && ` / ${stint.importedBaseline.sourceStintName}`}
                  </span>
                )}
              </div>
            )}

            {/* Show imported baseline values (read-only) */}
            {isImported && (
              <div className="space-y-3 opacity-80">
                <BaselineReadonlyDisplay baseline={baseline} pressureUnit={pressureUnit} temperatureUnit={temperatureUnit} />
              </div>
            )}
          </div>
        ) : (
          /* ──── Manual Tab ──── */
          <div className="space-y-5">
            {/* Recommended cold pressures banner */}
            {recommendedColdPressures && (
              <div className="bg-teal-900/20 border border-teal-700/50 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-teal-300">
                    Recommended Cold Pressures (from previous stint)
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleApplyRecommended}>
                    Apply
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {CORNERS.map((c) => (
                    <div key={c} className="text-center">
                      <div className="text-xs text-gray-400">{c}</div>
                      <div className="text-sm font-bold text-teal-400 tabular-nums">
                        {recommendedColdPressures[c]?.toFixed(2) ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compound selector */}
            <div>
              <Select
                label="Compound"
                value={baseline.compound ?? "medium"}
                onChange={(v) => onBaselineUpdate({ compound: v as CompoundType })}
                options={[
                  { value: "soft", label: "Soft" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                  { value: "wet", label: "Wet" },
                  { value: "custom", label: "Custom" },
                ]}
              />
            </div>

            {/* Cold Tire Temps */}
            <div>
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Cold Tire Temperatures
              </h4>
              <div className="grid grid-cols-4 gap-3">
                {CORNERS.map((c) => (
                  <NumericInput
                    key={c}
                    label={c}
                    unit={`°${temperatureUnit}`}
                    value={baseline.startTireTemps?.[c]}
                    onChange={(v) => handleStartTireTemp(c, v)}
                  />
                ))}
              </div>
            </div>

            {/* Start Cold Pressures */}
            <div>
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Start Cold Pressures
              </h4>
              <div className="grid grid-cols-4 gap-3">
                {CORNERS.map((c) => (
                  <NumericInput
                    key={c}
                    label={c}
                    unit={pressureUnit}
                    value={baseline.coldPressures?.[c]}
                    onChange={(v) => handleColdPressure(c, v)}
                  />
                ))}
              </div>
            </div>

            {/* Target Hot Pressure */}
            <div>
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Target Hot Pressure
              </h4>
              <div className="space-y-3">
                <Select
                  label="Target Mode"
                  value={baseline.targetMode}
                  onChange={handleTargetModeChange}
                  options={TARGET_MODE_OPTIONS}
                />

                {baseline.targetMode === "single" && (
                  <NumericInput
                    label="Target Hot"
                    unit={pressureUnit}
                    value={baseline.targets.singleTargetHotPressure}
                    onChange={handleSingleTarget}
                  />
                )}

                {baseline.targetMode === "front-rear" && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumericInput
                      label="Front Target"
                      unit={pressureUnit}
                      value={baseline.targets.frontTargetHotPressure}
                      onChange={handleFrontTarget}
                    />
                    <NumericInput
                      label="Rear Target"
                      unit={pressureUnit}
                      value={baseline.targets.rearTargetHotPressure}
                      onChange={handleRearTarget}
                    />
                  </div>
                )}

                {baseline.targetMode === "four-corner" && (
                  <div className="grid grid-cols-4 gap-3">
                    {CORNERS.map((c) => (
                      <NumericInput
                        key={c}
                        label={`${c} Target`}
                        unit={pressureUnit}
                        value={baseline.targets.cornerTargets?.[c]}
                        onChange={(v) => handleCornerTarget(c, v)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ambient & Asphalt Conditions */}
            <div>
              <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Conditions
                {weatherConditions && (
                  <span className="text-gray-500 normal-case font-normal ml-2">
                    (API: {weatherConditions.ambient}°/{weatherConditions.asphalt}° — your input overrides)
                  </span>
                )}
              </h4>

              {/* Prediction time picker */}
              {getForecastAtTime && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-700/40 rounded">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUsePrediction()}
                  >
                    🌤 Use Current Prediction
                  </Button>
                  <span className="text-xs text-gray-500">or at:</span>
                  <input
                    type="time"
                    value={predictionTime}
                    onChange={(e) => setPredictionTime(e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 w-28"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUsePrediction(predictionTime || undefined)}
                    disabled={!predictionTime}
                  >
                    Apply
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <NumericInput
                  label="Ambient Temp"
                  unit={`°${temperatureUnit}`}
                  value={baseline.ambientMeasured}
                  onChange={handleAmbientChange}
                  placeholder={weatherConditions?.ambient.toString()}
                />
                <NumericInput
                  label="Asphalt Temp"
                  unit={`°${temperatureUnit}`}
                  value={baseline.asphaltMeasured}
                  onChange={handleAsphaltChange}
                  placeholder={weatherConditions?.asphalt.toString()}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Read-only display for imported baselines ──────────────────────

function BaselineReadonlyDisplay({
  baseline,
  pressureUnit,
  temperatureUnit,
}: {
  baseline: StintBaseline;
  pressureUnit: string;
  temperatureUnit: string;
}) {
  return (
    <div className="space-y-3">
      {/* Cold Pressures */}
      <div>
        <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          Cold Pressures
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {CORNERS.map((c) => (
            <div key={c} className="text-center">
              <div className="text-xs text-gray-500">{c}</div>
              <div className="text-sm text-gray-300 tabular-nums">
                {baseline.coldPressures?.[c]?.toFixed(2) ?? "—"} {pressureUnit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start Tire Temps */}
      <div>
        <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          Cold Tire Temps
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {CORNERS.map((c) => (
            <div key={c} className="text-center">
              <div className="text-xs text-gray-500">{c}</div>
              <div className="text-sm text-gray-300 tabular-nums">
                {baseline.startTireTemps?.[c]?.toFixed(1) ?? "—"} °{temperatureUnit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target */}
      <div>
        <h4 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
          Target ({baseline.targetMode})
        </h4>
        {baseline.targetMode === "single" && (
          <p className="text-sm text-gray-300">
            {baseline.targets.singleTargetHotPressure?.toFixed(2) ?? "—"} {pressureUnit}
          </p>
        )}
        {baseline.targetMode === "front-rear" && (
          <p className="text-sm text-gray-300">
            Front: {baseline.targets.frontTargetHotPressure?.toFixed(2) ?? "—"} / Rear:{" "}
            {baseline.targets.rearTargetHotPressure?.toFixed(2) ?? "—"} {pressureUnit}
          </p>
        )}
        {baseline.targetMode === "four-corner" && (
          <div className="grid grid-cols-4 gap-2">
            {CORNERS.map((c) => (
              <div key={c} className="text-center">
                <div className="text-xs text-gray-500">{c}</div>
                <div className="text-sm text-gray-300 tabular-nums">
                  {baseline.targets.cornerTargets?.[c]?.toFixed(2) ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conditions */}
      <div className="flex gap-6">
        <div>
          <span className="text-xs text-gray-500">Ambient: </span>
          <span className="text-sm text-gray-300">
            {baseline.ambientMeasured?.toFixed(1) ?? "—"} °{temperatureUnit}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-500">Asphalt: </span>
          <span className="text-sm text-gray-300">
            {baseline.asphaltMeasured?.toFixed(1) ?? "—"} °{temperatureUnit}
          </span>
        </div>
      </div>
    </div>
  );
}
