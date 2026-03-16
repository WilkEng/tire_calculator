"use client";

import { useEventContext } from "@/context/EventContext";
import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AdBanner } from "@/components/shared/AdBanner";
import type { PressureUnit, TemperatureUnit, TargetMode } from "@/lib/domain/models";
import { COMPOUND_PRESETS, BUILT_IN_COMPOUNDS } from "@/lib/domain/models";
import type { CustomCompound } from "@/lib/domain/models";
import { generateId } from "@/lib/utils/helpers";
import { displayTemp, inputTemp, displayPressure, inputPressure, displayKTemp, inputKTemp, pressureDecimals, displayTempDelta, inputTempDelta } from "@/lib/utils/helpers";

export default function SettingsPage() {
  const { settings, updateSettings } = useEventContext();

  // ── Custom compound helpers ──
  const addCustomCompound = () => {
    const newCompound: CustomCompound = {
      id: generateId(),
      name: "",
      kAmbient: 1.0,
      kTrack: 1.75,
      minColdPressureBar: 1.3,
    };
    updateSettings({
      customCompounds: [...(settings.customCompounds ?? []), newCompound],
    });
  };

  const updateCustomCompound = (id: string, updates: Partial<CustomCompound>) => {
    updateSettings({
      customCompounds: (settings.customCompounds ?? []).map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  };

  const deleteCustomCompound = (id: string) => {
    updateSettings({
      customCompounds: (settings.customCompounds ?? []).filter((c) => c.id !== id),
    });
  };

  // ── Build compound options for default compound selector ──
  const compoundOptions = [
    ...BUILT_IN_COMPOUNDS.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    ...(settings.customCompounds ?? []).map((c) => ({
      value: c.id,
      label: c.name || `Custom (${c.id.slice(0, 6)})`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-100">Settings</h1>

      {/* ── Units ── */}
      <Card title="Units">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumericInput
            label="Default Start Tire Temp"
            unit={`°${settings.unitsTemperature}`}
            value={displayTemp(settings.defaultStartTireTemp, settings.unitsTemperature)}
            onChange={(v) =>
              updateSettings({ defaultStartTireTemp: v != null ? inputTemp(v, settings.unitsTemperature) : 25 })
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
      <Card title="Event Carry-Over">
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
            Enable event-to-event carry-over
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2">
          When enabled, prior event data gently biases recommendations.
          Same-event data always dominates.
        </p>
      </Card>

      {/* ── Pressure Sensitivity ── */}
      <Card title="Pressure Sensitivity">
        <div className="space-y-3">
          <NumericInput
            label={`k_temp (${settings.unitsPressure}/°${settings.unitsTemperature})`}
            value={displayKTemp(settings.kTemp, settings.unitsPressure, settings.unitsTemperature)}
            onChange={(v) => updateSettings({ kTemp: v != null ? inputKTemp(v, settings.unitsPressure, settings.unitsTemperature) : 0.0105 })}
          />
          <p className="text-xs text-gray-500">
            {`How much cold pressure changes per °${settings.unitsTemperature} of temperature delta. Higher = more aggressive corrections.`}
          </p>
        </div>
      </Card>

      {/* ── Compounds ── */}
      <Card title="Tire Compounds">
        <div className="space-y-5">
          {/* Default compound selector */}
          <Select
            label="Default Compound"
            value={settings.defaultCompound ?? "medium"}
            onChange={(v) => updateSettings({ defaultCompound: v })}
            options={compoundOptions}
          />

          {/* Built-in compound settings */}
          <div className="space-y-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
              Built-in Compounds
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Each compound has its own k_ambient, k_track, and minimum cold pressure.
            </p>

            {BUILT_IN_COMPOUNDS.map((cmp) => {
              const userCoeffs = settings.compoundCoefficients?.[cmp];
              const defaults = COMPOUND_PRESETS[cmp];
              const kAmb = userCoeffs?.kAmbient ?? defaults.kAmbient;
              const kTrk = userCoeffs?.kTrack ?? defaults.kTrack;
              const minP = userCoeffs?.minColdPressureBar ?? defaults.minColdPressureBar;
              return (
                <div
                  key={cmp}
                  className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200 capitalize">
                      {cmp}
                    </span>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-300"
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
                      ↺ Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      label={`Min Cold Pressure (${settings.unitsPressure})`}
                      value={displayPressure(minP, settings.unitsPressure)}
                      onChange={(v) => {
                        const prev = settings.compoundCoefficients ?? { ...COMPOUND_PRESETS };
                        updateSettings({
                          compoundCoefficients: {
                            ...prev,
                            [cmp]: { ...prev[cmp], minColdPressureBar: v != null ? inputPressure(v, settings.unitsPressure) : defaults.minColdPressureBar },
                          },
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom compounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                Custom Compounds
              </div>
              <Button variant="secondary" size="sm" onClick={addCustomCompound}>
                + Add Compound
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Define custom tire compounds with their own K values and min cold pressure.
            </p>

            {(settings.customCompounds ?? []).length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">
                No custom compounds defined. Click &ldquo;+ Add Compound&rdquo; to create one.
              </p>
            ) : (
              (settings.customCompounds ?? []).map((cc) => (
                <div
                  key={cc.id}
                  className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/30 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex flex-col gap-1">
                      <span className="text-[10px] text-gray-400 uppercase font-medium">Name</span>
                      <input
                        type="text"
                        value={cc.name}
                        onChange={(e) => updateCustomCompound(cc.id, { name: e.target.value })}
                        placeholder="e.g. Supersoft, Inter, Rain..."
                        className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50"
                      />
                    </label>
                    <button
                      className="text-xs text-red-400 hover:text-red-300 mt-4 px-2"
                      onClick={() => deleteCustomCompound(cc.id)}
                      title="Delete compound"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <NumericInput
                      label="k_ambient"
                      value={cc.kAmbient}
                      onChange={(v) => updateCustomCompound(cc.id, { kAmbient: v ?? 1.0 })}
                    />
                    <NumericInput
                      label="k_track"
                      value={cc.kTrack}
                      onChange={(v) => updateCustomCompound(cc.id, { kTrack: v ?? 1.75 })}
                    />
                    <NumericInput
                      label={`Min Cold Pressure (${settings.unitsPressure})`}
                      value={displayPressure(cc.minColdPressureBar, settings.unitsPressure)}
                      onChange={(v) => updateCustomCompound(cc.id, { minColdPressureBar: v != null ? inputPressure(v, settings.unitsPressure) : 1.3 })}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Camber spread threshold */}
          <div className="pt-3 border-t border-gray-700/40">
            <NumericInput
              label={`Camber Spread Threshold (°${settings.unitsTemperature})`}
              value={displayTempDelta(settings.camberSpreadThreshold ?? 12, settings.unitsTemperature)}
              onChange={(v) =>
                updateSettings({ camberSpreadThreshold: v != null ? inputTempDelta(v, settings.unitsTemperature) : 12 })
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

      <AdBanner />
    </div>
  );
}
