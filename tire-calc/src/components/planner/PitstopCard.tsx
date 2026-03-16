"use client";

import { useState } from "react";
import type { PitstopEntry, Corner, CornerTemperatureReading } from "@/lib/domain/models";
import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { displayPressure, inputPressure, pressureDecimals } from "@/lib/utils/helpers";

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
}: PitstopCardProps) {
  const [collapsed, setCollapsed] = useState(!isLatest);
  const [tempsOpen, setTempsOpen] = useState(false);

  const getBledDisplayValue = (corner: Corner): number | undefined => {
    return pitstop.hotCorrectedPressures?.[corner] ?? pitstop.hotMeasuredPressures?.[corner];
  };

  const hasTempData = CORNERS.some((c) => {
    const r = pitstop.temperatureReadings?.[c];
    return r && (r.inner != null || r.middle != null || r.outer != null);
  });

  const handleTempChange = (
    corner: Corner,
    field: keyof CornerTemperatureReading,
    value: number | undefined
  ) => {
    const prev = pitstop.temperatureReadings ?? {};
    const prevCorner = prev[corner] ?? { inner: undefined as unknown as number, middle: undefined as unknown as number, outer: undefined as unknown as number };
    onUpdate({
      temperatureReadings: {
        ...prev,
        [corner]: { ...prevCorner, [field]: value },
      },
    });
  };

  return (
    <Card
      title={`Pitstop ${pitstop.index}`}
      className={isLatest ? "ring-1 ring-[#00d4aa]/50" : ""}
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
          {pitstop.hotMeasuredPressures?.FL != null ? `Hot FL: ${displayPressure(pitstop.hotMeasuredPressures.FL, pressureUnit).toFixed(pressureDecimals(pressureUnit))} ${pressureUnit}` : "No data"}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3 border-b border-gray-700 pb-1">
              Hot Measured 
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CORNERS.map((c) => (
                <NumericInput
                  key={c}
                  label={c}
                  unit={pressureUnit}
                  value={pitstop.hotMeasuredPressures?.[c] != null ? displayPressure(pitstop.hotMeasuredPressures[c]!, pressureUnit) : undefined}
                  onChange={(val) => onHotPressureChange(c, val != null ? inputPressure(val, pressureUnit) : undefined)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-1">
              <h4 className="text-sm font-semibold text-gray-300">
                Bled / Corrected
              </h4>
            </div>
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
                            <span title="Manually edited (locked)">🔒</span>
                          )}
                        </span>
                      }
                      unit={pressureUnit}
                      value={getBledDisplayValue(c) != null ? displayPressure(getBledDisplayValue(c)!, pressureUnit) : undefined}
                      onChange={(val) => onBledPressureChange(c, val != null ? inputPressure(val, pressureUnit) : undefined)}
                    />
                    {isLocked && (
                      <button
                        onClick={() => onResetBledCorner(c)}
                        className="absolute -top-2 -right-2 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full hover:bg-gray-600 transition-colors"
                        title="Reset to hot measured"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Temperature Readings (expandable) ── */}
          <div className="border-t border-gray-700/50 pt-2">
            <button
              onClick={() => setTempsOpen(!tempsOpen)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors w-full"
            >
              <span className={`transition-transform ${tempsOpen ? "rotate-90" : ""}`}>▶</span>
              <span className="font-medium">Pyrometer Readings</span>
              {hasTempData && (
                <span className="ml-auto text-[10px] text-[#00d4aa]/70 font-mono">has data</span>
              )}
            </button>
            {tempsOpen && (
              <div className="mt-3 space-y-3">
                {CORNERS.map((corner) => {
                  const reading = pitstop.temperatureReadings?.[corner];
                  return (
                    <div key={corner} className="p-2 bg-gray-800/50 rounded-lg border border-gray-700/30">
                      <div className="text-xs font-medium text-gray-300 mb-2">{corner}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <NumericInput
                          label="Inner"
                          unit="°"
                          value={reading?.inner}
                          onChange={(v) => handleTempChange(corner, "inner", v)}
                        />
                        <NumericInput
                          label="Middle"
                          unit="°"
                          value={reading?.middle}
                          onChange={(v) => handleTempChange(corner, "middle", v)}
                        />
                        <NumericInput
                          label="Outer"
                          unit="°"
                          value={reading?.outer}
                          onChange={(v) => handleTempChange(corner, "outer", v)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
