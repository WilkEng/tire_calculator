"use client";

import { useState, useMemo, useCallback } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";
import { Select } from "@/components/ui/Select";
import { PyroPickerModal } from "@/components/temperature/PyroPickerModal";
import type { PyroDataSource } from "@/components/temperature/PyroPickerModal";
import type {
  TemperatureRun,
  CornerTemperatureReading,
  Corner,
  FourCornerTemperatureReadings,
} from "@/lib/domain/models";
import { createTemperatureRun } from "@/lib/domain/factories";
import { round } from "@/lib/utils/helpers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];
const CORNER_LABELS: Record<Corner, string> = {
  FL: "Front Left",
  FR: "Front Right",
  RL: "Rear Left",
  RR: "Rear Right",
};
const ZONES = ["inner", "middle", "outer"] as const;

/**
 * Zone ordering per corner — from CENTER of car outward.
 * Left-side tires (FL, RL): the "inside" faces car center, so graph reads Outside → Middle → Inside
 *   (left edge of chart = outside of tire = leftmost on vehicle, right edge = inside = towards center)
 * Right-side tires (FR, RR): the "inside" faces car center, so graph reads Inside → Middle → Outside
 *   (left edge = inside = towards center, right edge = outside of tire = rightmost on vehicle)
 */
const ZONE_ORDER: Record<Corner, readonly (keyof CornerTemperatureReading)[]> = {
  FL: ["outer", "middle", "inner"],
  FR: ["inner", "middle", "outer"],
  RL: ["outer", "middle", "inner"],
  RR: ["inner", "middle", "outer"],
};

const ZONE_LABELS: Record<string, string> = {
  inner: "Inside",
  middle: "Middle",
  outer: "Outside",
};

// ─── Warning types ─────────────────────────────────────────────────

type WarningLevel = "too_much" | "slightly_too_much" | "perfect" | "slightly_too_little" | "too_little";
type PressureWarning = "too_high" | "slightly_too_high" | "perfect" | "slightly_too_low" | "too_low";

const WARNING_COLORS: Record<WarningLevel | PressureWarning, string> = {
  too_much: "#ef4444",
  slightly_too_much: "#f59e0b",
  perfect: "#00d4aa",
  slightly_too_little: "#f59e0b",
  too_little: "#ef4444",
  too_high: "#ef4444",
  slightly_too_high: "#f59e0b",
  slightly_too_low: "#f59e0b",
  too_low: "#ef4444",
};

const WARNING_LABELS: Record<WarningLevel | PressureWarning, string> = {
  too_much: "Too much camber",
  slightly_too_much: "Slightly too much",
  perfect: "Perfect",
  slightly_too_little: "Slightly too little",
  too_little: "Too little camber",
  too_high: "Pressure too high",
  slightly_too_high: "Pressure slightly high",
  slightly_too_low: "Pressure slightly low",
  too_low: "Pressure too low",
};

/**
 * Assess camber based on configurable spread threshold.
 * The spread is divided into thirds:
 *   ≤ threshold/3 → perfect
 *   ≤ 2*threshold/3 → slight
 *   > 2*threshold/3 → warning
 */
function assessCamber(camberDelta: number, spreadThreshold: number): WarningLevel {
  const abs = Math.abs(camberDelta);
  const third = spreadThreshold / 3;
  if (abs <= third) return "perfect";
  if (camberDelta > 0) {
    return abs <= 2 * third ? "slightly_too_much" : "too_much";
  }
  return abs <= 2 * third ? "slightly_too_little" : "too_little";
}

function assessPressure(avgTemp: number, targetAvg: number): PressureWarning {
  const delta = avgTemp - targetAvg;
  if (Math.abs(delta) <= 3) return "perfect";
  if (delta > 0) return delta <= 8 ? "slightly_too_high" : "too_high";
  return delta >= -8 ? "slightly_too_low" : "too_low";
}

// ─── Data source types ─────────────────────────────────────────────

interface DataSource {
  id: string;
  label: string;
  type: "run" | "pitstop";
  readings: Partial<FourCornerTemperatureReadings>;
  notes?: string;
}

// ─── Line colors for data sources ──────────────────────────────────

const LINE_PALETTE = [
  "#00d4aa", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ─── Chart tooltip ─────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded px-3 py-2 shadow-lg text-xs max-w-xs">
      <p className="text-gray-400 font-medium mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string; payload?: { notes?: Record<string, string> } }, i: number) => (
        <div key={i}>
          <p className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value?.toFixed(1)}°{unit}
          </p>
          {entry.payload?.notes?.[entry.name] && (
            <p className="text-gray-500 ml-4 italic text-[10px]">
              {entry.payload.notes[entry.name]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Warning Badge Component ───────────────────────────────────────

function WarningBadge({ level, label }: { level: WarningLevel | PressureWarning; label: string }) {
  const color = WARNING_COLORS[level];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {level === "perfect" ? "✓" : "⚠"} {label}
    </span>
  );
}

// ─── Corner Chart Component (Line Chart) ───────────────────────────

function CornerChart({
  corner,
  sources,
  averagedReading,
  unit,
  spreadThreshold,
}: {
  corner: Corner;
  sources: DataSource[];
  averagedReading: CornerTemperatureReading | null;
  unit: string;
  spreadThreshold: number;
}) {
  const zoneOrder = ZONE_ORDER[corner];

  // Build chart data: x-axis = zone positions, each source is a separate line
  // Each data point: { zone: "Outside", "Run 1": 95, "Run 2": 88, "Average": 91, notes: { "Run 1": "some note" } }
  const { chartData, lineKeys } = useMemo(() => {
    const allSources = [...sources];
    if (averagedReading) {
      allSources.push({
        id: "__avg__",
        label: "Average",
        type: "run",
        readings: { [corner]: averagedReading },
      });
    }

    const keys: { key: string; color: string; isDashed: boolean; notes?: string }[] = [];
    for (let i = 0; i < allSources.length; i++) {
      const src = allSources[i];
      keys.push({
        key: src.label,
        color: src.id === "__avg__" ? "#ffffff" : LINE_PALETTE[i % LINE_PALETTE.length],
        isDashed: src.id === "__avg__",
        notes: src.notes,
      });
    }

    const data = zoneOrder.map((zone) => {
      const point: Record<string, unknown> = { zone: ZONE_LABELS[zone] };
      const notesMap: Record<string, string> = {};
      for (const src of allSources) {
        const r = src.readings[corner];
        if (r) {
          point[src.label] = r[zone];
        }
        if (src.notes) {
          notesMap[src.label] = src.notes;
        }
      }
      point.notes = notesMap;
      return point;
    });

    return { chartData: data, lineKeys: keys };
  }, [sources, averagedReading, corner, zoneOrder]);

  // Compute derived metrics
  const metrics = useMemo(() => {
    const reading = averagedReading ?? (sources.length === 1 ? sources[0]?.readings[corner] : null);
    if (!reading) return null;

    const avg = round((reading.inner + reading.middle + reading.outer) / 3, 1);
    const camberDelta = round(reading.inner - reading.outer, 1);
    const camberWarning = assessCamber(camberDelta, spreadThreshold);
    const pressureWarning = assessPressure(avg, 85);

    return { avg, camberDelta, camberWarning, pressureWarning };
  }, [averagedReading, sources, corner, spreadThreshold]);

  if (lineKeys.length === 0) {
    return (
      <Card title={`${CORNER_LABELS[corner]} (${corner})`}>
        <div className="text-sm text-gray-500 text-center py-8">
          No data selected for this corner
        </div>
      </Card>
    );
  }

  return (
    <Card title={`${CORNER_LABELS[corner]} (${corner})`}>
      <div className="space-y-3">
        {/* Chart */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="zone"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "#4b5563" }}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                unit="°"
                axisLine={{ stroke: "#4b5563" }}
              />
              <Tooltip content={<ChartTooltip unit={unit} />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                iconSize={8}
              />
              {metrics && (
                <ReferenceLine
                  y={metrics.avg}
                  stroke="#6b728055"
                  strokeDasharray="3 3"
                  label={{ value: `Avg ${metrics.avg}°`, position: "right", fill: "#6b7280", fontSize: 9 }}
                />
              )}
              {lineKeys.map((lk) => (
                <Line
                  key={lk.key}
                  type="monotone"
                  dataKey={lk.key}
                  stroke={lk.color}
                  strokeWidth={lk.isDashed ? 2 : 1.5}
                  strokeDasharray={lk.isDashed ? "6 3" : undefined}
                  dot={{ fill: lk.color, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Notes legend */}
        {sources.some((s) => s.notes) && (
          <div className="space-y-0.5 pt-1 border-t border-gray-700/30">
            {sources.filter((s) => s.notes).map((s, i) => (
              <p key={s.id} className="text-[10px] text-gray-500 flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: LINE_PALETTE[sources.indexOf(s) % LINE_PALETTE.length] }}
                />
                <span className="italic truncate">{s.notes}</span>
              </p>
            ))}
          </div>
        )}

        {/* Metrics & Warnings */}
        {metrics && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700/40">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Avg Temp</div>
              <div className="text-sm font-semibold text-gray-200 tabular-nums">
                {metrics.avg}°{unit}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase">Δ Camber (In−Out)</div>
              <div className="text-sm font-semibold text-gray-200 tabular-nums">
                {metrics.camberDelta > 0 ? "+" : ""}{metrics.camberDelta}°{unit}
              </div>
            </div>
            <div className="col-span-2 flex flex-wrap gap-2">
              <WarningBadge level={metrics.camberWarning} label={WARNING_LABELS[metrics.camberWarning]} />
              <WarningBadge level={metrics.pressureWarning} label={WARNING_LABELS[metrics.pressureWarning]} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════

export default function TemperatureAnalysisPage() {
  const { session, updateSession, settings } = useSessionContext();
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [showAverage, setShowAverage] = useState(true);
  const [runsExpanded, setRunsExpanded] = useState(false);
  const [showPyroPicker, setShowPyroPicker] = useState(false);
  const [importedSources, setImportedSources] = useState<DataSource[]>([]);

  const spreadThreshold = settings.camberSpreadThreshold ?? 12;

  // ── Build all available data sources (current session + imported) ──
  const dataSources: DataSource[] = useMemo(() => {
    if (!session) return [];
    const sources: DataSource[] = [];

    // Temperature runs from current session
    for (let i = 0; i < session.temperatureRuns.length; i++) {
      const run = session.temperatureRuns[i];
      sources.push({
        id: `run-${run.id}`,
        label: `Run ${i + 1}${run.setupTag ? ` (${run.setupTag})` : ""}`,
        type: "run",
        readings: run.readings,
        notes: run.notes || undefined,
      });
    }

    // Pitstops with temperature readings from current session
    for (const stint of session.stints) {
      for (const pit of stint.pitstops) {
        if (pit.temperatureReadings && Object.keys(pit.temperatureReadings).length > 0) {
          const hasData = CORNERS.some((c) => {
            const r = pit.temperatureReadings?.[c];
            return r && (r.inner || r.middle || r.outer);
          });
          if (hasData) {
            sources.push({
              id: `pit-${pit.id}`,
              label: `${stint.name} P${pit.index}`,
              type: "pitstop",
              readings: pit.temperatureReadings,
              notes: pit.notes || undefined,
            });
          }
        }
      }
    }

    // Add imported sources (from other sessions via picker)
    sources.push(...importedSources);

    return sources;
  }, [session, importedSources]);

  // ── Selected sources ──
  const selectedSources = useMemo(
    () => dataSources.filter((s) => selectedSourceIds.has(s.id)),
    [dataSources, selectedSourceIds]
  );

  // ── Computed averages across selected sources ──
  const averagedReadings = useMemo(() => {
    if (selectedSources.length < 2 || !showAverage) return null;

    const result: Record<Corner, CornerTemperatureReading | null> = {
      FL: null, FR: null, RL: null, RR: null,
    };

    for (const corner of CORNERS) {
      let count = 0;
      let sumI = 0, sumM = 0, sumO = 0;

      for (const src of selectedSources) {
        const r = src.readings[corner];
        if (!r) continue;
        sumI += r.inner;
        sumM += r.middle;
        sumO += r.outer;
        count++;
      }

      if (count > 0) {
        result[corner] = {
          inner: round(sumI / count, 1),
          middle: round(sumM / count, 1),
          outer: round(sumO / count, 1),
        };
      }
    }

    return result;
  }, [selectedSources, showAverage]);

  // ── Toggle source selection ──
  const toggleSource = useCallback((id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSourceIds(new Set(dataSources.map((s) => s.id)));
  }, [dataSources]);

  const selectNone = useCallback(() => {
    setSelectedSourceIds(new Set());
  }, []);

  // ── Handle imported pyro sources from picker ──
  const handleImportPyroSources = useCallback((sources: PyroDataSource[]) => {
    // Convert to DataSource format, prefixing labels with session context
    const imported: DataSource[] = sources.map((s) => ({
      id: s.id,
      label: `${s.sessionName} › ${s.label}`,
      type: s.type,
      readings: s.readings,
      notes: s.notes,
    }));
    setImportedSources(imported);
    // Auto-select the imported sources
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      for (const src of imported) next.add(src.id);
      return next;
    });
  }, []);

  // ── Add new temperature run ──
  const handleAddRun = () => {
    if (!session || !session.stints?.length) return;
    const latestStint = session.stints[session.stints.length - 1];
    const latestPitstop = latestStint.pitstops?.[latestStint.pitstops.length - 1];
    const newRun = createTemperatureRun({
      linkedPitstopId: latestPitstop?.id,
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
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowPyroPicker(true)}>
            📂 Load from History
          </Button>
          <Button size="sm" onClick={handleAddRun}>
            + Add Temperature Run
          </Button>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-4 py-2 text-sm text-yellow-200">
        Probe / pyrometer data is for analysis only. It is not used in the Level 1 pressure recommendation engine.
      </div>

      {/* ── Data Source Selector & Comparison Charts ── */}
      {(dataSources.length > 0 || importedSources.length > 0) && (
        <Card title="Comparison Charts">
          <div className="space-y-4">
            {/* Source selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase font-medium">Select Readings to Compare</span>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowPyroPicker(true)}
                  >
                    📂 Load from History
                  </Button>
                  <button onClick={selectAll} className="text-[10px] text-[#00d4aa] hover:text-[#00d4aa]/80">
                    Select all
                  </button>
                  <button onClick={selectNone} className="text-[10px] text-gray-500 hover:text-gray-300">
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dataSources.map((src) => {
                  const active = selectedSourceIds.has(src.id);
                  return (
                    <button
                      key={src.id}
                      onClick={() => toggleSource(src.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        active
                          ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa]"
                          : "bg-gray-800/50 border-gray-700/40 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {src.type === "pitstop" ? "🏁 " : "🌡 "}
                      {src.label}
                      {src.notes && <span className="ml-1 text-gray-500">📝</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Average toggle */}
            {selectedSources.length >= 2 && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={showAverage}
                  onChange={(e) => setShowAverage(e.target.checked)}
                  className="accent-[#00d4aa] w-4 h-4"
                />
                Show combined average
              </label>
            )}

            {/* 4-corner line charts in 2×2 grid */}
            {selectedSources.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CORNERS.map((corner) => (
                  <CornerChart
                    key={corner}
                    corner={corner}
                    sources={selectedSources}
                    averagedReading={averagedReadings?.[corner] ?? null}
                    unit={settings.unitsTemperature}
                    spreadThreshold={spreadThreshold}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Select one or more readings above to see comparison charts.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* ── Group Filter & Averages ── */}
      {(groups.length > 0 || session.temperatureRuns.length > 0) && (
        <Card title="Run Averages">
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
                Averaging {groupedAverages.runCount} run(s) &middot; Spread threshold: {spreadThreshold}°C
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {CORNERS.map((c) => {
                  const avg = groupedAverages.averages[c];
                  const camberDelta = round(avg.inner - avg.outer, 1);
                  const camberLevel = assessCamber(camberDelta, spreadThreshold);
                  return (
                    <div key={c} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/30">
                      <div className="text-xs text-gray-400 font-semibold mb-2">
                        {c}
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs text-center mb-2">
                        <div>
                          <div className="text-gray-500">Inner</div>
                          <div className="text-gray-200 tabular-nums">
                            {avg.inner}°
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Mid</div>
                          <div className="text-gray-200 tabular-nums">
                            {avg.middle}°
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500">Outer</div>
                          <div className="text-gray-200 tabular-nums">
                            {avg.outer}°
                          </div>
                        </div>
                      </div>
                      <div className="text-center text-sm font-semibold text-[#00d4aa] mb-1">
                        Avg: {avg.avg}°{settings.unitsTemperature}
                      </div>
                      <div className="text-center text-[10px] text-gray-400 mb-1">
                        Δ Camber: {camberDelta > 0 ? "+" : ""}{camberDelta}°
                      </div>
                      <div className="flex justify-center">
                        <WarningBadge level={camberLevel} label={WARNING_LABELS[camberLevel]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data for the selected group.</p>
          )}
        </Card>
      )}

      {/* ── Individual Runs (collapsible) ── */}
      <Card
        title="Temperature Runs"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRunsExpanded(!runsExpanded)}>
              {runsExpanded ? "Collapse" : "Expand"}
            </Button>
            <Button size="sm" onClick={handleAddRun}>
              + Add Run
            </Button>
          </div>
        }
      >
        {session.temperatureRuns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No temperature runs recorded. Add one to start logging pyrometer / probe readings.
          </p>
        ) : !runsExpanded ? (
          <p className="text-sm text-gray-500">
            {session.temperatureRuns.length} run(s) recorded. Click &quot;Expand&quot; to view/edit.
          </p>
        ) : (
          <div className="space-y-4">
            {session.temperatureRuns.map((run, idx) => (
              <div
                key={run.id}
                className="p-4 bg-gray-800/40 rounded-lg border border-gray-700/30 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-200">Run {idx + 1}</h4>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteRun(run.id)}>
                    Remove
                  </Button>
                </div>

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
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50"
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
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50"
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
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50"
                      placeholder="Run notes..."
                    />
                  </label>
                </div>

                {/* Temperature readings per corner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {CORNERS.map((corner) => (
                    <div key={corner} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/20">
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
            ))}
          </div>
        )}
      </Card>

      {/* ── Pyro Picker Modal ── */}
      <PyroPickerModal
        open={showPyroPicker}
        onClose={() => setShowPyroPicker(false)}
        onSelect={handleImportPyroSources}
        currentSessionId={session.id}
      />
    </div>
  );
}
