"use client";

import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import type { PressureUnit, TemperatureUnit, TargetMode, CompoundType, CompoundCoefficients } from "@/lib/domain/models";
import { COMPOUND_PRESETS } from "@/lib/domain/models";

export default function SettingsPage() {
  const { settings, updateSettings } = useSessionContext();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-100">Settings</h1>

      {/* ── Units ── */}
      <Card title="Units">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Pressure Unit"
            value={settings.unitsPressure}
            onChange={(v) => updateSettings({ unitsPressure: v as PressureUnit })}
            options={[
              { value: "bar", label: "bar" },
              { value: "psi", label: "psi" },
              { value: "kPa", label: "kPa" },
            ]}
          />
          <Select
            label="Temperature Unit"
            value={settings.unitsTemperature}
            onChange={(v) =>
              updateSettings({ unitsTemperature: v as TemperatureUnit })
            }
            options={[
              { value: "C", label: "°C" },
              { value: "F", label: "°F" },
            ]}
          />
        </div>
      </Card>

      {/* ── Defaults ── */}
      <Card title="Defaults">
        <div className="grid grid-cols-2 gap-4">
          <NumericInput
            label="Default Start Tire Temp"
            unit={`°${settings.unitsTemperature}`}
            value={settings.defaultStartTireTemp}
            onChange={(v) =>
              updateSettings({ defaultStartTireTemp: v ?? 25 })
            }
          />
          <Select
            label="Default Target Mode"
            value={settings.defaultTargetMode}
            onChange={(v) =>
              updateSettings({ defaultTargetMode: v as TargetMode })
            }
            options={[
              { value: "single", label: "Single" },
              { value: "front-rear", label: "Front / Rear" },
              { value: "four-corner", label: "Four Corner" },
            ]}
          />
        </div>
      </Card>

      {/* ── Carry-Over ── */}
      <Card title="Session Carry-Over">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.carryOverEnabled}
            onChange={(e) =>
              updateSettings({ carryOverEnabled: e.target.checked })
            }
            className="accent-[#00d4aa] w-4 h-4"
          />
          <span className="text-gray-200">
            Enable session-to-session carry-over
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2">
          When enabled, prior session data gently biases recommendations.
          Same-session data always dominates.
        </p>
      </Card>

      {/* ── Compound & Coefficients ── */}
      <Card title="Compounds & Coefficients">
        <div className="space-y-5">
          {/* Classic mode toggles */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.classicModeEnabled}
                onChange={(e) =>
                  updateSettings({ classicModeEnabled: e.target.checked })
                }
                className="accent-[#00d4aa] w-4 h-4"
              />
              <span className="text-gray-200">Enable classic Wilkinson mode as baseline</span>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.advancedModeEnabled}
                onChange={(e) =>
                  updateSettings({ advancedModeEnabled: e.target.checked })
                }
                className="accent-[#00d4aa] w-4 h-4"
              />
              <span className="text-gray-200">Show advanced coefficient settings</span>
            </label>
          </div>

          {/* Global coefficients (advanced) */}
          {settings.advancedModeEnabled && (
            <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/40 space-y-3">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                Global Coefficients (used when compound = Custom)
              </div>
              <div className="grid grid-cols-3 gap-4">
                <NumericInput
                  label="k_temp (bar/°C)"
                  value={settings.kTemp}
                  onChange={(v) => updateSettings({ kTemp: v ?? 0.012 })}
                />
                <NumericInput
                  label="k_track (asphalt wt)"
                  value={settings.kTrack}
                  onChange={(v) => updateSettings({ kTrack: v ?? 1.75 })}
                />
                <NumericInput
                  label="k_ambient (ambient wt)"
                  value={settings.kAmbient}
                  onChange={(v) => updateSettings({ kAmbient: v ?? 1.0 })}
                />
              </div>
              <p className="text-[10px] text-gray-500">
                effectiveTempDelta = (ΔAmbient × k_ambient) + (ΔAsphalt × k_track) + (ΔStartTire × 1.0)
                &middot; conditionCorrection = effectiveTempDelta × k_temp
              </p>
            </div>
          )}

          {/* Default compound */}
          <Select
            label="Default Compound"
            value={settings.defaultCompound ?? "medium"}
            onChange={(v) =>
              updateSettings({ defaultCompound: v as CompoundType })
            }
            options={[
              { value: "soft", label: "Soft" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
              { value: "wet", label: "Wet" },
              { value: "custom", label: "Custom (use global k values)" },
            ]}
          />

          {/* Per-compound settings */}
          <div className="space-y-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
              Per-Compound Coefficients &amp; Thresholds
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Each compound has its own k_ambient, k_track, and minimum cold pressure threshold.
            </p>

            {(["soft", "medium", "hard", "wet"] as const).map((cmp) => {
              const userCoeffs = settings.compoundCoefficients?.[cmp];
              const defaults = COMPOUND_PRESETS[cmp];
              const kAmb = userCoeffs?.kAmbient ?? defaults.kAmbient;
              const kTrk = userCoeffs?.kTrack ?? defaults.kTrack;
              const minP = userCoeffs?.minColdPressureBar ?? defaults.minColdPressureBar;
              return (
                <div
                  key={cmp}
                  className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 items-end p-3 bg-gray-800/60 rounded-lg border border-gray-700/30"
                >
                  <span className="text-sm font-medium text-gray-200 capitalize pb-1">
                    {cmp}
                  </span>
                  <NumericInput
                    label="k_ambient"
                    value={kAmb}
                    onChange={(v) => {
                      const prev = settings.compoundCoefficients ?? { ...COMPOUND_PRESETS };
                      updateSettings({
                        compoundCoefficients: {
                          ...prev,
                          [cmp]: { ...prev[cmp], kAmbient: v ?? defaults.kAmbient },
                        },
                      });
                    }}
                  />
                  <NumericInput
                    label="k_track"
                    value={kTrk}
                    onChange={(v) => {
                      const prev = settings.compoundCoefficients ?? { ...COMPOUND_PRESETS };
                      updateSettings({
                        compoundCoefficients: {
                          ...prev,
                          [cmp]: { ...prev[cmp], kTrack: v ?? defaults.kTrack },
                        },
                      });
                    }}
                  />
                  <NumericInput
                    label="Min Cold (bar)"
                    value={minP}
                    onChange={(v) => {
                      const prev = settings.compoundCoefficients ?? { ...COMPOUND_PRESETS };
                      updateSettings({
                        compoundCoefficients: {
                          ...prev,
                          [cmp]: { ...prev[cmp], minColdPressureBar: v ?? defaults.minColdPressureBar },
                        },
                      });
                    }}
                  />
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300 pb-1"
                    onClick={() => {
                      const prev = settings.compoundCoefficients ?? { ...COMPOUND_PRESETS };
                      updateSettings({
                        compoundCoefficients: {
                          ...prev,
                          [cmp]: { ...COMPOUND_PRESETS[cmp] },
                        },
                      });
                    }}
                    title="Reset to default"
                  >
                    ↺
                  </button>
                </div>
              );
            })}
          </div>

          {/* Global fallback min pressure */}
          <div className="pt-3 border-t border-gray-700/40">
            <NumericInput
              label="Global Min Cold Pressure Fallback (bar)"
              value={settings.minColdPressureBar ?? 1.3}
              onChange={(v) =>
                updateSettings({ minColdPressureBar: v ?? 1.3 })
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Used when no compound-specific threshold is set. Cold pressures below this are highlighted in red.
            </p>
          </div>

          {/* Camber spread threshold */}
          <div className="pt-3 border-t border-gray-700/40">
            <NumericInput
              label="Camber Spread Threshold (°C)"
              value={settings.camberSpreadThreshold ?? 12}
              onChange={(v) =>
                updateSettings({ camberSpreadThreshold: v ?? 12 })
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Temperature spread (inner − outer) beyond this threshold indicates too much or too little camber.
              Values within ⅓ of this threshold are &quot;perfect&quot;, within ⅔ are &quot;slight&quot;, beyond are warnings.
            </p>
          </div>
        </div>
      </Card>

      {/* ── App Info ── */}
      <Card title="About">
        <div className="space-y-1 text-sm text-gray-400">
          <div className="flex justify-between">
            <span>App Version</span>
            <span className="text-gray-200">{settings.appVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>Schema Version</span>
            <span className="text-gray-200">{settings.schemaVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>Weather Provider</span>
            <span className="text-gray-200">{settings.weatherProvider}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
