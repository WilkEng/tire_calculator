"use client";

import { useState } from "react";
import type { PitstopEntry, TargetMode, Corner } from "@/lib/domain/models";
import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

interface PitstopCardProps {
  pitstop: PitstopEntry;
  onUpdate: (updates: Partial<PitstopEntry>) => void;
  onHotPressureChange: (corner: Corner, value: number | undefined) => void;
  onBledPressureChange: (corner: Corner, value: number | undefined) => void;
  onResetBledCorner: (corner: Corner) => void;
  onRemove: () => void;
  isLatest: boolean;
  pressureUnit: string;
  temperatureUnit: string;
}

const TARGET_MODE_OPTIONS = [
  { value: "single", label: "Single Target" },
  { value: "front-rear", label: "Front / Rear" },
  { value: "four-corner", label: "Four Corner" },
];

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

export function PitstopCard({
  pitstop,
  onUpdate,
  onHotPressureChange,
  onBledPressureChange,
  onResetBledCorner,
  onRemove,
  isLatest,
  pressureUnit,
  temperatureUnit,
}: PitstopCardProps) {
  const [collapsed, setCollapsed] = useState(!isLatest);

  const updateTarget = (key: string, value: number | undefined) => {
    onUpdate({
      targets: { ...pitstop.targets, [key]: value },
    });
  };

  const updateCornerTarget = (corner: string, value: number | undefined) => {
    const current = pitstop.targets.cornerTargets ?? { FL: 0, FR: 0, RL: 0, RR: 0 };
    onUpdate({
      targets: {
        ...pitstop.targets,
        cornerTargets: { ...current, [corner]: value ?? 0 },
      },
    });
  };

  /** Display value for bled: explicit override or hot measured fallback */
  const getBledDisplayValue = (corner: Corner): number | undefined => {
    return pitstop.hotCorrectedPressures?.[corner] ?? pitstop.hotMeasuredPressures?.[corner];
  };

  return (
    <Card
      title={`Pitstop ${pitstop.index}`}
      className={isLatest ? "ring-1 ring-blue-500" : ""}
      actions={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "Expand" : "Collapse"}
          </Button>
          <Button variant="danger" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      }
    >
      {collapsed ? (
        <div className="text-sm text-gray-400">
          {pitstop.targetMode} target
          {pitstop.hotMeasuredPressures?.FL != null && ` · Hot FL: ${pitstop.hotMeasuredPressures.FL} ${pressureUnit}`}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Target Mode & Targets ── */}
          <div>
            <Select
              label="Target Mode"
              value={pitstop.targetMode}
              onChange={(v) => onUpdate({ targetMode: v as TargetMode })}
              options={TARGET_MODE_OPTIONS}
              className="max-w-xs"
            />

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pitstop.targetMode === "single" && (
                <NumericInput
                  label="Target Hot"
                  unit={pressureUnit}
                  value={pitstop.targets.singleTargetHotPressure}
                  onChange={(v) => updateTarget("singleTargetHotPressure", v)}
                />
              )}
              {pitstop.targetMode === "front-rear" && (
                <>
                  <NumericInput
                    label="Front Target"
                    unit={pressureUnit}
                    value={pitstop.targets.frontTargetHotPressure}
                    onChange={(v) => updateTarget("frontTargetHotPressure", v)}
                  />
                  <NumericInput
                    label="Rear Target"
                    unit={pressureUnit}
                    value={pitstop.targets.rearTargetHotPressure}
                    onChange={(v) => updateTarget("rearTargetHotPressure", v)}
                  />
                </>
              )}
              {pitstop.targetMode === "four-corner" &&
                CORNERS.map((c) => (
                  <NumericInput
                    key={c}
                    label={`${c} Target`}
                    unit={pressureUnit}
                    value={pitstop.targets.cornerTargets?.[c]}
                    onChange={(v) => updateCornerTarget(c, v)}
                  />
                ))}
            </div>
          </div>

          {/* ── Hot Measured Pressures ── */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Hot Measured Pressures
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CORNERS.map((c) => (
                <NumericInput
                  key={c}
                  label={c}
                  unit={pressureUnit}
                  value={pitstop.hotMeasuredPressures?.[c]}
                  onChange={(v) => onHotPressureChange(c, v)}
                />
              ))}
            </div>
          </div>

          {/* ── Bled / Corrected Pressures ── */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Bled / Corrected Pressures
              <span className="text-gray-500 ml-2 normal-case font-normal">
                (defaults to hot — edit a corner to override)
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CORNERS.map((c) => {
                const isLocked = pitstop.bledLocked?.[c] === true;
                return (
                  <div key={c} className="relative">
                    <NumericInput
                      label={
                        <span className="flex items-center gap-1">
                          {c}
                          {isLocked && (
                            <button
                              onClick={() => onResetBledCorner(c)}
                              className="text-[10px] text-yellow-400 hover:text-yellow-300 ml-1"
                              title="Reset to auto-follow hot"
                            >
                              ↺
                            </button>
                          )}
                        </span>
                      }
                      unit={pressureUnit}
                      value={getBledDisplayValue(c)}
                      onChange={(v) => onBledPressureChange(c, v)}
                    />
                    {isLocked && (
                      <div className="absolute -top-0.5 right-0 text-[9px] text-yellow-500">
                        edited
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Optional Hot Tire Temps ── */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Hot Tire Temps
              <span className="text-gray-500 ml-2 normal-case font-normal">
                (optional)
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CORNERS.map((c) => (
                <NumericInput
                  key={c}
                  label={c}
                  unit={`°${temperatureUnit}`}
                  value={pitstop.hotTireTemps?.[c]}
                  onChange={(v) =>
                    onUpdate({
                      hotTireTemps: { ...pitstop.hotTireTemps, [c]: v },
                    })
                  }
                />
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Notes
              </span>
              <textarea
                value={pitstop.notes ?? ""}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                rows={2}
                className="
                  bg-gray-800 border border-gray-600 rounded px-3 py-2
                  text-sm text-white resize-y
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  placeholder-gray-500
                "
                placeholder="Stint notes..."
              />
            </label>
          </div>
        </div>
      )}
    </Card>
  );
}
