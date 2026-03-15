"use client";

import { useState } from "react";
import type { PitstopEntry, Corner } from "@/lib/domain/models";
import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
  onHotPressureChange,
  onBledPressureChange,
  onResetBledCorner,
  onRemove,
  isLatest,
  pressureUnit,
}: PitstopCardProps) {
  const [collapsed, setCollapsed] = useState(!isLatest);

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
          {pitstop.hotMeasuredPressures?.FL != null ? `Hot FL: ${pitstop.hotMeasuredPressures.FL} ${pressureUnit}` : "No data"}
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
                  value={pitstop.hotMeasuredPressures?.[c]}
                  onChange={(val) => onHotPressureChange(c, val)}
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
                            <span title="Manually edited (locked)">??</span>
                          )}
                        </span>
                      }
                      unit={pressureUnit}
                      value={getBledDisplayValue(c)}
                      onChange={(val) => onBledPressureChange(c, val)}
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
        </div>
      )}
    </Card>
  );
}
