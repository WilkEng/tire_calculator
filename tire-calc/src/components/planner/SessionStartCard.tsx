"use client";

import type { SessionStartBaseline } from "@/lib/domain/models";
import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";

interface SessionStartCardProps {
  baseline: SessionStartBaseline;
  onUpdate: (updates: Partial<SessionStartBaseline>) => void;
  pressureUnit: string;
  temperatureUnit: string;
}

export function SessionStartCard({
  baseline,
  onUpdate,
  pressureUnit,
  temperatureUnit,
}: SessionStartCardProps) {
  const updateColdCorner = (corner: string, value: number | undefined) => {
    onUpdate({
      coldPressures: { ...baseline.coldPressures, [corner]: value },
    });
  };

  const updateTireTempCorner = (corner: string, value: number | undefined) => {
    onUpdate({
      startTireTemps: { ...baseline.startTireTemps, [corner]: value },
    });
  };

  return (
    <Card title="Session Start — Baseline" className="border-green-800">
      {/* ── Cold Start Pressures ── */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Cold Start Pressures
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["FL", "FR", "RL", "RR"] as const).map((c) => (
            <NumericInput
              key={c}
              label={c}
              unit={pressureUnit}
              value={baseline.coldPressures?.[c]}
              onChange={(v) => updateColdCorner(c, v)}
            />
          ))}
        </div>
      </div>

      {/* ── Optional Conditions ── */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Starting Conditions
          <span className="text-gray-500 ml-2 normal-case font-normal">
            (optional — manual entry overrides forecast)
          </span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumericInput
            label="Ambient"
            unit={`°${temperatureUnit}`}
            value={baseline.ambientMeasured}
            onChange={(v) => onUpdate({ ambientMeasured: v })}
          />
          <NumericInput
            label="Asphalt"
            unit={`°${temperatureUnit}`}
            value={baseline.asphaltMeasured}
            onChange={(v) => onUpdate({ asphaltMeasured: v })}
          />
          <NumericInput
            label="Amb. Forecast"
            unit={`°${temperatureUnit}`}
            value={baseline.ambientForecast}
            onChange={(v) => onUpdate({ ambientForecast: v })}
          />
          <NumericInput
            label="Asph. Forecast"
            unit={`°${temperatureUnit}`}
            value={baseline.asphaltForecast}
            onChange={(v) => onUpdate({ asphaltForecast: v })}
          />
        </div>
      </div>

      {/* ── Optional Starting Tire Temps ── */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Starting Tire Temps
          <span className="text-gray-500 ml-2 normal-case font-normal">
            (optional)
          </span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["FL", "FR", "RL", "RR"] as const).map((c) => (
            <NumericInput
              key={c}
              label={c}
              unit={`°${temperatureUnit}`}
              value={baseline.startTireTemps?.[c]}
              onChange={(v) => updateTireTempCorner(c, v)}
            />
          ))}
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="mt-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Session Start Notes
          </span>
          <textarea
            value={baseline.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={2}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white resize-y
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder-gray-500
            "
            placeholder="Baseline notes..."
          />
        </label>
      </div>
    </Card>
  );
}
