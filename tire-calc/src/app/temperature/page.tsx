"use client";

import { useState, useMemo, useCallback } from "react";
import { useEventContext } from "@/context/EventContext";
import { useSessionState } from "@/hooks/useSessionState";
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
import { generateId } from "@/lib/utils/helpers";
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
 * Right-side tires (FR, RR): the "inside" faces car center, so graph reads Inside → Middle → Outside
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
 * Assess camber from the temperature spread.
 *
 * `camberDelta` = inner − outer (positive ⇒ inside hotter).
 * `spreadThreshold` is the *expected* inside-hotter delta for the current
 * camber setting. We compare the actual delta against that expectation.
 *
 * deviation = camberDelta − spreadThreshold
 *   |dev| ≤ 3  → perfect
 *   |dev| ≤ 6  → slightly too much / too little
 *   |dev| > 6  → too much / too little
 */
function assessCamber(camberDelta: number, spreadThreshold: number): WarningLevel {
  const deviation = camberDelta - spreadThreshold;
  const abs = Math.abs(deviation);
  if (abs <= 3) return "perfect";
  if (deviation > 0) {
    return abs <= 6 ? "slightly_too_much" : "too_much";
  }
  return abs <= 6 ? "slightly_too_little" : "too_little";
}

/**
 * Assess tyre pressure from inner/middle/outer temperatures.
 *
 * `pressureDelta` = middle − avg(inner, outer).
 * Positive ⇒ centre is hotter ⇒ pressure too high.
 * Negative ⇒ centre is colder  ⇒ pressure too low.
 *
 *   |delta| ≤ 3  → perfect
 *   |delta| ≤ 6  → slightly too high / low
 *   |delta| > 6  → too high / low
 */
function assessPressure(pressureDelta: number): PressureWarning {
  const abs = Math.abs(pressureDelta);
  if (abs <= 3) return "perfect";
  if (pressureDelta > 0) {
    return abs <= 6 ? "slightly_too_high" : "too_high";
  }
  return abs <= 6 ? "slightly_too_low" : "too_low";
}

// ─── Data source types ─────────────────────────────────────────────

interface DataSource {
  id: string;
  label: string;
  type: "run" | "pitstop";
  readings: Partial<FourCornerTemperatureReadings>;
  notes?: string;
}

// ─── Comparison line type ──────────────────────────────────────────

interface ComparisonLine {
  id: string;
  name: string;
  sourceIds: string[];
  color: string;
}

// ─── Line colors ───────────────────────────────────────────────────

const LINE_PALETTE = [
  "#00d4aa", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ─── Helpers ───────────────────────────────────────────────────────

/** Average readings from multiple sources for a given corner */
function averageCornerReadings(
  sources: DataSource[],
  corner: Corner
): CornerTemperatureReading | null {
  let count = 0;
  let sumI = 0, sumM = 0, sumO = 0;
  for (const src of sources) {
    const r = src.readings[corner];
    if (!r) continue;
    sumI += r.inner;
    sumM += r.middle;
    sumO += r.outer;
    count++;
  }
  if (count === 0) return null;
  return {
    inner: round(sumI / count, 1),
    middle: round(sumM / count, 1),
    outer: round(sumO / count, 1),
  };
}

// ─── Resolved line (with computed readings) ────────────────────────

interface ResolvedLine {
  id: string;
  name: string;
  color: string;
  isAveraged: boolean;
  /** The resolved reading per corner (either from single source or averaged) */
  readings: Partial<Record<Corner, CornerTemperatureReading>>;
  /** Notes from sources */
  notes?: string;
}

function resolveLines(
  lines: ComparisonLine[],
  allSources: DataSource[]
): ResolvedLine[] {
  return lines.map((line) => {
    const sources = allSources.filter((s) => line.sourceIds.includes(s.id));
    const isAveraged = sources.length > 1;
    const readings: Partial<Record<Corner, CornerTemperatureReading>> = {};

    for (const corner of CORNERS) {
      if (isAveraged) {
        const avg = averageCornerReadings(sources, corner);
        if (avg) readings[corner] = avg;
      } else if (sources.length === 1) {
        const r = sources[0].readings[corner];
        if (r) readings[corner] = r;
      }
    }

    const notesList = sources.filter((s) => s.notes).map((s) => s.notes!);
    return {
      id: line.id,
      name: line.name,
      color: line.color,
      isAveraged,
      readings,
      notes: notesList.length > 0 ? notesList.join("; ") : undefined,
    };
  });
}

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
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i}>
          <p className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            {entry.name}: {entry.value?.toFixed(1)}°{unit}
          </p>
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

// ─── Corner Chart Component (Line-based) ───────────────────────────

function CornerChart({
  corner,
  resolvedLines,
  unit,
  spreadThreshold,
}: {
  corner: Corner;
  resolvedLines: ResolvedLine[];
  unit: string;
  spreadThreshold: number;
}) {
  const zoneOrder = ZONE_ORDER[corner];

  // Build chart data: each resolved line becomes a line on the chart
  const { chartData, lineKeys } = useMemo(() => {
    const keys: { key: string; color: string; isDashed: boolean }[] = [];
    for (const rl of resolvedLines) {
      keys.push({
        key: rl.name,
        color: rl.color,
        isDashed: rl.isAveraged,
      });
    }

    const data = zoneOrder.map((zone) => {
      const point: Record<string, unknown> = { zone: ZONE_LABELS[zone] };
      for (const rl of resolvedLines) {
        const r = rl.readings[corner];
        if (r) {
          point[rl.name] = r[zone];
        }
      }
      return point;
    });

    return { chartData: data, lineKeys: keys };
  }, [resolvedLines, corner, zoneOrder]);

  // Compute metrics/warnings PER LINE
  const lineMetrics = useMemo(() => {
    return resolvedLines.map((rl) => {
      const reading = rl.readings[corner];
      if (!reading) return null;
      const avg = round((reading.inner + reading.middle + reading.outer) / 3, 1);
      const camberDelta = round(reading.inner - reading.outer, 1);
      const camberWarning = assessCamber(camberDelta, spreadThreshold);
      const pressureDelta = round(reading.middle - (reading.inner + reading.outer) / 2, 1);
      const pressureWarning = assessPressure(pressureDelta);
      return { lineName: rl.name, color: rl.color, avg, camberDelta, pressureDelta, camberWarning, pressureWarning };
    }).filter(Boolean) as {
      lineName: string; color: string; avg: number; camberDelta: number; pressureDelta: number;
      camberWarning: WarningLevel; pressureWarning: PressureWarning;
    }[];
  }, [resolvedLines, corner, spreadThreshold]);

  if (lineKeys.length === 0) {
    return (
      <Card title={`${CORNER_LABELS[corner]} (${corner})`}>
        <div className="text-sm text-gray-500 text-center py-8">
          No data for this corner
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

        {/* Per-line Metrics & Warnings */}
        {lineMetrics.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-700/40">
            {lineMetrics.map((m) => (
              <div key={m.lineName} className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-xs font-medium text-gray-300">{m.lineName}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pl-4">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Avg Temp</div>
                    <div className="text-sm font-semibold text-gray-200 tabular-nums">
                      {m.avg}°{unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Δ Camber (In−Out)</div>
                    <div className="text-sm font-semibold text-gray-200 tabular-nums">
                      {m.camberDelta > 0 ? "+" : ""}{m.camberDelta}°{unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">Δ Pressure (Mid−Avg)</div>
                    <div className="text-sm font-semibold text-gray-200 tabular-nums">
                      {m.pressureDelta > 0 ? "+" : ""}{m.pressureDelta}°{unit}
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-wrap gap-2">
                    <WarningBadge level={m.camberWarning} label={WARNING_LABELS[m.camberWarning]} />
                    <WarningBadge level={m.pressureWarning} label={WARNING_LABELS[m.pressureWarning]} />
                  </div>
                </div>
              </div>
            ))}
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
  const { event, updateEvent, settings } = useEventContext();
  const eid = event?.id ?? "__none__";
  const [selectedGroup, setSelectedGroup] = useSessionState<string>(`temp-group-${eid}`, "all");
  const [comparisonLines, setComparisonLines] = useSessionState<ComparisonLine[]>(`temp-lines-${eid}`, []);
  const [runsExpanded, setRunsExpanded] = useSessionState(`temp-runsExp-${eid}`, false);
  const [showPyroPicker, setShowPyroPicker] = useState(false);
  const [importedSources, setImportedSources] = useSessionState<DataSource[]>(`temp-imported-${eid}`, []);

  const spreadThreshold = settings.camberSpreadThreshold ?? 9;

  // ── Build all available data sources (current event + imported) ──
  const dataSources: DataSource[] = useMemo(() => {
    const sources: DataSource[] = [];
    if (!event) return [...importedSources];

    // Temperature runs from current event
    for (let i = 0; i < event.temperatureRuns.length; i++) {
      const run = event.temperatureRuns[i];
      sources.push({
        id: `run-${run.id}`,
        label: `Run ${i + 1}${run.setupTag ? ` (${run.setupTag})` : ""}`,
        type: "run",
        readings: run.readings,
        notes: run.notes || undefined,
      });
    }

    // Pitstops with temperature readings from current event
    for (const stint of event.stints) {
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

    // Add imported sources (from other events via picker)
    sources.push(...importedSources);

    return sources;
  }, [event, importedSources]);

  // ── Resolve comparison lines ──
  const resolvedLines = useMemo(
    () => resolveLines(comparisonLines, dataSources),
    [comparisonLines, dataSources]
  );

  // ── Line management ──
  const addLine = useCallback(() => {
    const idx = comparisonLines.length;
    setComparisonLines((prev) => [
      ...prev,
      {
        id: generateId(),
        name: `Line ${idx + 1}`,
        sourceIds: [],
        color: LINE_PALETTE[idx % LINE_PALETTE.length],
      },
    ]);
  }, [comparisonLines.length]);

  const removeLine = useCallback((lineId: string) => {
    setComparisonLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const updateLineName = useCallback((lineId: string, name: string) => {
    setComparisonLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, name } : l))
    );
  }, []);

  const toggleSourceInLine = useCallback((lineId: string, sourceId: string) => {
    setComparisonLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const has = l.sourceIds.includes(sourceId);
        return {
          ...l,
          sourceIds: has
            ? l.sourceIds.filter((id) => id !== sourceId)
            : [...l.sourceIds, sourceId],
        };
      })
    );
  }, []);

  /** Quick-add: create one line per source (individual lines) */
  const addIndividualLines = useCallback(() => {
    const existing = new Set(comparisonLines.flatMap((l) => l.sourceIds));
    const newLines: ComparisonLine[] = [];
    for (const src of dataSources) {
      if (existing.has(src.id)) continue;
      newLines.push({
        id: generateId(),
        name: src.label,
        sourceIds: [src.id],
        color: LINE_PALETTE[(comparisonLines.length + newLines.length) % LINE_PALETTE.length],
      });
    }
    if (newLines.length > 0) {
      setComparisonLines((prev) => [...prev, ...newLines]);
    }
  }, [comparisonLines, dataSources]);

  /** Quick-add: create one averaged line from all sources */
  const addAverageLine = useCallback(() => {
    setComparisonLines((prev) => [
      ...prev,
      {
        id: generateId(),
        name: "Average (All)",
        sourceIds: dataSources.map((s) => s.id),
        color: LINE_PALETTE[prev.length % LINE_PALETTE.length],
      },
    ]);
  }, [dataSources]);

  const clearLines = useCallback(() => {
    setComparisonLines([]);
  }, []);

  // ── Handle imported pyro sources from picker ──
  const handleImportPyroSources = useCallback((sources: PyroDataSource[]) => {
    const imported: DataSource[] = sources.map((s) => ({
      id: s.id,
      label: `${s.eventName} › ${s.label}`,
      type: s.type,
      readings: s.readings,
      notes: s.notes,
    }));
    setImportedSources(imported);
    // Auto-create individual lines for imported sources
    const newLines: ComparisonLine[] = imported.map((src, i) => ({
      id: generateId(),
      name: src.label,
      sourceIds: [src.id],
      color: LINE_PALETTE[(comparisonLines.length + i) % LINE_PALETTE.length],
    }));
    if (newLines.length > 0) {
      setComparisonLines((prev) => [...prev, ...newLines]);
    }
  }, [comparisonLines.length]);

  // ── Add new temperature run ──
  const handleAddRun = () => {
    if (!event || !event.stints?.length) return;
    const latestStint = event.stints[event.stints.length - 1];
    const latestPitstop = latestStint.pitstops?.[latestStint.pitstops.length - 1];
    const newRun = createTemperatureRun({
      linkedPitstopId: latestPitstop?.id,
    });
    updateEvent({
      temperatureRuns: [...event.temperatureRuns, newRun],
    });
  };

  // ── Update a run ──
  const handleUpdateRun = (runId: string, updates: Partial<TemperatureRun>) => {
    if (!event) return;
    updateEvent({
      temperatureRuns: event.temperatureRuns.map((r) =>
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
    if (!event) return;
    const run = event.temperatureRuns.find((r) => r.id === runId);
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
    if (!event) return;
    updateEvent({
      temperatureRuns: event.temperatureRuns.filter((r) => r.id !== runId),
    });
  };

  // ── Compute averages for runs in selected group ──
  const groupedAverages = useMemo(() => {
    if (!event) return null;

    const runs =
      selectedGroup === "all"
        ? event.temperatureRuns
        : event.temperatureRuns.filter(
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
  }, [event, selectedGroup]);

  // ── Get unique groups for filter ──
  const groups = useMemo(() => {
    if (!event) return [];
    const tags = new Set<string>();
    for (const r of event.temperatureRuns) {
      if (r.hotPressureGroup) tags.add(r.hotPressureGroup);
      if (r.setupTag) tags.add(r.setupTag);
    }
    return Array.from(tags);
  }, [event]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-100">Temperature Analysis</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowPyroPicker(true)}>
            📂 Load from History
          </Button>
          {event && (
            <Button size="sm" onClick={handleAddRun}>
              + Add Temperature Run
            </Button>
          )}
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-4 py-2 text-sm text-yellow-200">
        Probe / pyrometer data is for analysis only. It is not used in the Level 1 pressure recommendation engine.
      </div>

      {/* ── Comparison Lines & Charts ── */}
      {(dataSources.length > 0 || importedSources.length > 0) && (
        <Card title="Comparison Charts">
          <div className="space-y-4">
            {/* Line management header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-400 uppercase font-medium">Comparison Lines</span>
              <div className="flex flex-wrap gap-2 items-center">
                <Button variant="secondary" size="sm" onClick={() => setShowPyroPicker(true)}>
                  📂 History
                </Button>
                <button onClick={addIndividualLines} className="text-[10px] text-[#00d4aa] hover:text-[#00d4aa]/80">
                  + All Individual
                </button>
                <button onClick={addAverageLine} className="text-[10px] text-[#00d4aa] hover:text-[#00d4aa]/80">
                  + Average All
                </button>
                <button onClick={clearLines} className="text-[10px] text-gray-500 hover:text-gray-300">
                  Clear
                </button>
              </div>
            </div>

            {/* Add line button */}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={addLine}>
                + Add Line
              </Button>
            </div>

            {/* Line list */}
            {comparisonLines.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Add a comparison line to start. Each line can include one source (individual) or multiple sources (averaged).
              </p>
            ) : (
              <div className="space-y-3">
                {comparisonLines.map((line) => {
                  const sourceCount = line.sourceIds.length;
                  return (
                    <div
                      key={line.id}
                      className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/30 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        {/* Color chip */}
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: line.color }}
                        />
                        {/* Editable name */}
                        <input
                          type="text"
                          value={line.name}
                          onChange={(e) => updateLineName(line.id, e.target.value)}
                          className="flex-1 bg-transparent border-b border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00d4aa] py-0.5 px-1"
                        />
                        {/* Info badge */}
                        <span className="text-[10px] text-gray-500">
                          {sourceCount === 0
                            ? "No sources"
                            : sourceCount === 1
                            ? "Individual"
                            : `Averaged (${sourceCount})`}
                        </span>
                        {/* Delete */}
                        <button
                          onClick={() => removeLine(line.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-1"
                          title="Remove line"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Source selector chips */}
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {dataSources.map((src) => {
                          const active = line.sourceIds.includes(src.id);
                          return (
                            <button
                              key={src.id}
                              onClick={() => toggleSourceInLine(line.id, src.id)}
                              className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
                                active
                                  ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa]"
                                  : "bg-gray-800/50 border-gray-700/40 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                              }`}
                            >
                              {src.type === "pitstop" ? "🏁 " : "🌡 "}
                              {src.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4-corner line charts in 2×2 grid */}
            {resolvedLines.length > 0 && resolvedLines.some((rl) => Object.keys(rl.readings).length > 0) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CORNERS.map((corner) => (
                  <CornerChart
                    key={corner}
                    corner={corner}
                    resolvedLines={resolvedLines}
                    unit={settings.unitsTemperature}
                    spreadThreshold={spreadThreshold}
                  />
                ))}
              </div>
            ) : comparisonLines.length > 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Select sources for your comparison lines to see charts.
              </p>
            ) : null}
          </div>
        </Card>
      )}

      {/* ── Group Filter & Averages ── */}
      {event && (groups.length > 0 || event.temperatureRuns.length > 0) && (
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
                  const pressureDelta = round(avg.middle - (avg.inner + avg.outer) / 2, 1);
                  const pressureLevel = assessPressure(pressureDelta);
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
                      <div className="text-center text-[10px] text-gray-400 mb-1">
                        Δ Pressure: {pressureDelta > 0 ? "+" : ""}{pressureDelta}°
                      </div>
                      <div className="flex flex-wrap justify-center gap-1">
                        <WarningBadge level={camberLevel} label={WARNING_LABELS[camberLevel]} />
                        <WarningBadge level={pressureLevel} label={WARNING_LABELS[pressureLevel]} />
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
      {event && (
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
        {event.temperatureRuns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No temperature runs recorded. Add one to start logging pyrometer / probe readings.
          </p>
        ) : !runsExpanded ? (
          <p className="text-sm text-gray-500">
            {event.temperatureRuns.length} run(s) recorded. Click &quot;Expand&quot; to view/edit.
          </p>
        ) : (
          <div className="space-y-4">
            {event.temperatureRuns.map((run, idx) => (
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
      )}

      {/* ── Pyro Picker Modal ── */}
      <PyroPickerModal
        open={showPyroPicker}
        onClose={() => setShowPyroPicker(false)}
        onSelect={handleImportPyroSources}
        currentEventId={event?.id}
      />
    </div>
  );
}
