"use client";

import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import type { PressureUnit, TemperatureUnit, TargetMode } from "@/lib/domain/models";

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
            className="accent-blue-500 w-4 h-4"
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

      {/* ── Classic Mode ── */}
      <Card title="Classic Wilkinson Mode">
        <label className="flex items-center gap-3 text-sm mb-4">
          <input
            type="checkbox"
            checked={settings.classicModeEnabled}
            onChange={(e) =>
              updateSettings({ classicModeEnabled: e.target.checked })
            }
            className="accent-blue-500 w-4 h-4"
          />
          <span className="text-gray-200">Enable classic mode as baseline</span>
        </label>

        <label className="flex items-center gap-3 text-sm mb-4">
          <input
            type="checkbox"
            checked={settings.advancedModeEnabled}
            onChange={(e) =>
              updateSettings({ advancedModeEnabled: e.target.checked })
            }
            className="accent-blue-500 w-4 h-4"
          />
          <span className="text-gray-200">Show advanced coefficient settings</span>
        </label>

        {settings.advancedModeEnabled && (
          <div className="grid grid-cols-3 gap-4 mt-2 p-3 bg-gray-800 rounded">
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
            <div className="col-span-3">
              <p className="text-xs text-gray-500">
                effectiveTempDelta = (ΔAmbient × k_ambient) + (ΔAsphalt × k_track)
                + (ΔStartTire × 1.0) · conditionCorrection = effectiveTempDelta × k_temp
              </p>
            </div>
          </div>
        )}
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
