"use client";

import { useState, useMemo } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import type {
  TemperatureRun,
  CornerTemperatureReading,
  Corner,
} from "@/lib/domain/models";
import { createTemperatureRun } from "@/lib/domain/factories";
import { round } from "@/lib/utils/helpers";

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];
const ZONES = ["inner", "middle", "outer"] as const;

export default function TemperatureAnalysisPage() {
  const { session, updateSession, settings } = useSessionContext();
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // ── Add new temperature run ──
  const handleAddRun = () => {
    if (!session) return;
    const newRun = createTemperatureRun({
      linkedPitstopId: session.pitstops[session.pitstops.length - 1]?.id,
    });
    updateSession({
      temperatureRuns: [...session.temperatureRuns, newRun],
    });
  };

  // ── Update a run ──
  const handleUpdateRun = (runId: string, updates: Partial<TemperatureRun>) => {
    if (!session) return;
    updateSession({
      temperatureRuns: session.temperatureRuns.map((r) =>
        r.id === runId ? { ...r, ...updates } : r
      ),
    });
  };

  // ── Update a corner reading within a run ──
  const handleUpdateCornerReading = (
    runId: string,
    corner: Corner,
    zone: (typeof ZONES)[number],
    value: number | undefined
  ) => {
    if (!session) return;
    const run = session.temperatureRuns.find((r) => r.id === runId);
    if (!run) return;

    const currentReading: CornerTemperatureReading = (run.readings[corner] as CornerTemperatureReading) ?? {
      inner: 0,
      middle: 0,
      outer: 0,
    };

    handleUpdateRun(runId, {
      readings: {
        ...run.readings,
        [corner]: {
          ...currentReading,
          [zone]: value ?? 0,
        },
      },
    });
  };

  // ── Delete a run ──
  const handleDeleteRun = (runId: string) => {
    if (!session) return;
    updateSession({
      temperatureRuns: session.temperatureRuns.filter((r) => r.id !== runId),
    });
  };

  // ── Compute averages for runs in selected group ──
  const groupedAverages = useMemo(() => {
    if (!session) return null;

    const runs =
      selectedGroup === "all"
        ? session.temperatureRuns
        : session.temperatureRuns.filter(
            (r) => r.hotPressureGroup === selectedGroup || r.setupTag === selectedGroup
          );

    if (runs.length === 0) return null;

    const averages: Record<Corner, { inner: number; middle: number; outer: number; avg: number }> = {
      FL: { inner: 0, middle: 0, outer: 0, avg: 0 },
      FR: { inner: 0, middle: 0, outer: 0, avg: 0 },
      RL: { inner: 0, middle: 0, outer: 0, avg: 0 },
      RR: { inner: 0, middle: 0, outer: 0, avg: 0 },
    };

    for (const corner of CORNERS) {
      let count = 0;
      for (const run of runs) {
        const reading = run.readings[corner] as CornerTemperatureReading | undefined;
        if (!reading) continue;
        averages[corner].inner += reading.inner;
        averages[corner].middle += reading.middle;
        averages[corner].outer += reading.outer;
        count++;
      }
      if (count > 0) {
        averages[corner].inner = round(averages[corner].inner / count, 1);
        averages[corner].middle = round(averages[corner].middle / count, 1);
        averages[corner].outer = round(averages[corner].outer / count, 1);
        averages[corner].avg = round(
          (averages[corner].inner + averages[corner].middle + averages[corner].outer) / 3,
          1
        );
      }
    }

    return { averages, runCount: runs.length };
  }, [session, selectedGroup]);

  // ── Get unique groups for filter ──
  const groups = useMemo(() => {
    if (!session) return [];
    const tags = new Set<string>();
    for (const r of session.temperatureRuns) {
      if (r.hotPressureGroup) tags.add(r.hotPressureGroup);
      if (r.setupTag) tags.add(r.setupTag);
    }
    return Array.from(tags);
  }, [session]);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <h1 className="text-2xl font-bold text-gray-200">Temperature Analysis</h1>
        <p className="text-gray-400">Load or create a session first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Temperature Analysis</h1>
        <Button size="sm" onClick={handleAddRun}>
          + Add Temperature Run
        </Button>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-4 py-2 text-sm text-yellow-200">
        Probe / pyrometer data is for analysis only. It is not used in the Level 1 pressure recommendation engine.
      </div>

      {/* ── Group Filter & Averages ── */}
      {(groups.length > 0 || session.temperatureRuns.length > 0) && (
        <Card title="Averages">
          <div className="mb-4">
            <Select
              label="Group / Filter"
              value={selectedGroup}
              onChange={setSelectedGroup}
              options={[
                { value: "all", label: "All Runs" },
                ...groups.map((g) => ({ value: g, label: g })),
              ]}
              className="max-w-xs"
            />
          </div>

          {groupedAverages ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                Averaging {groupedAverages.runCount} run(s)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {CORNERS.map((c) => (
                  <div key={c} className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-gray-400 font-semibold mb-2">
                      {c}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center mb-2">
                      <div>
                        <div className="text-gray-500">Inner</div>
                        <div className="text-gray-200 tabular-nums">
                          {groupedAverages.averages[c].inner}°
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Mid</div>
                        <div className="text-gray-200 tabular-nums">
                          {groupedAverages.averages[c].middle}°
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Outer</div>
                        <div className="text-gray-200 tabular-nums">
                          {groupedAverages.averages[c].outer}°
                        </div>
                      </div>
                    </div>
                    <div className="text-center text-sm font-semibold text-blue-400">
                      Avg: {groupedAverages.averages[c].avg}°{settings.unitsTemperature}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data for the selected group.</p>
          )}
        </Card>
      )}

      {/* ── Individual Runs ── */}
      {session.temperatureRuns.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">
            No temperature runs recorded. Add one to start logging pyrometer / probe readings.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {session.temperatureRuns.map((run, idx) => (
            <Card
              key={run.id}
              title={`Run ${idx + 1}`}
              actions={
                <Button variant="danger" size="sm" onClick={() => handleDeleteRun(run.id)}>
                  Remove
                </Button>
              }
            >
              <div className="space-y-4">
                {/* Tags */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 font-medium uppercase">Setup Tag</span>
                    <input
                      type="text"
                      value={run.setupTag ?? ""}
                      onChange={(e) =>
                        handleUpdateRun(run.id, { setupTag: e.target.value })
                      }
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Baseline"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 font-medium uppercase">
                      Hot Pressure Group
                    </span>
                    <input
                      type="text"
                      value={run.hotPressureGroup ?? ""}
                      onChange={(e) =>
                        handleUpdateRun(run.id, { hotPressureGroup: e.target.value })
                      }
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 1.85 bar"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400 font-medium uppercase">Notes</span>
                    <input
                      type="text"
                      value={run.notes ?? ""}
                      onChange={(e) =>
                        handleUpdateRun(run.id, { notes: e.target.value })
                      }
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Run notes..."
                    />
                  </label>
                </div>

                {/* Temperature readings per corner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {CORNERS.map((corner) => (
                    <div key={corner} className="bg-gray-800 rounded p-3">
                      <div className="text-xs text-gray-400 font-semibold mb-2">
                        {corner}
                      </div>
                      <div className="space-y-2">
                        {ZONES.map((zone) => (
                          <NumericInput
                            key={zone}
                            label={zone.charAt(0).toUpperCase() + zone.slice(1)}
                            unit={`°${settings.unitsTemperature}`}
                            value={
                              (run.readings[corner] as CornerTemperatureReading | undefined)?.[zone]
                            }
                            onChange={(v) =>
                              handleUpdateCornerReading(run.id, corner, zone, v)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
