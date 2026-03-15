"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar, useSessionFilter } from "@/components/ui/SearchFilterBar";
import { getAllSessions } from "@/lib/persistence/db";
import type {
  Session,
  Corner,
  CornerTemperatureReading,
  FourCornerTemperatureReadings,
} from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

export interface PyroDataSource {
  id: string;
  label: string;
  type: "run" | "pitstop";
  readings: Partial<FourCornerTemperatureReadings>;
  notes?: string;
  /** For display context */
  sessionName: string;
  sessionDate?: string;
  vehicle?: string;
  location?: string;
  compound?: string;
}

interface PyroPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sources: PyroDataSource[]) => void;
  /** Currently active session ID (to label it separately) */
  currentSessionId?: string;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

function hasPyroData(readings: Partial<FourCornerTemperatureReadings> | undefined): boolean {
  if (!readings) return false;
  return CORNERS.some((c) => {
    const r = readings[c] as CornerTemperatureReading | undefined;
    return r && (r.inner || r.middle || r.outer);
  });
}

/** Extract all pyro data sources from a session */
function extractPyroSources(session: Session): PyroDataSource[] {
  const sources: PyroDataSource[] = [];

  // Temperature runs
  for (let i = 0; i < session.temperatureRuns.length; i++) {
    const run = session.temperatureRuns[i];
    if (hasPyroData(run.readings)) {
      sources.push({
        id: `${session.id}-run-${run.id}`,
        label: `Run ${i + 1}${run.setupTag ? ` (${run.setupTag})` : ""}`,
        type: "run",
        readings: run.readings,
        notes: run.notes || undefined,
        sessionName: session.name,
        sessionDate: session.date,
        vehicle: session.vehicle,
        location: session.location,
        compound: session.compoundPreset,
      });
    }
  }

  // Pitstops with temperature readings
  for (const stint of session.stints) {
    for (const pit of stint.pitstops) {
      if (hasPyroData(pit.temperatureReadings)) {
        sources.push({
          id: `${session.id}-pit-${pit.id}`,
          label: `${stint.name} P${pit.index}`,
          type: "pitstop",
          readings: pit.temperatureReadings!,
          notes: pit.notes || undefined,
          sessionName: session.name,
          sessionDate: session.date,
          vehicle: session.vehicle,
          location: session.location,
          compound: session.compoundPreset,
        });
      }
    }
  }

  return sources;
}

// ─── Component ─────────────────────────────────────────────────────

export function PyroPickerModal({
  open,
  onClose,
  onSelect,
  currentSessionId,
}: PyroPickerModalProps) {
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load sessions from IndexedDB when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedIds(new Set());
    setExpandedSession(null);
    getAllSessions()
      .then(setAllSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  // Filter sessions to those with pyro data
  const sessionsWithPyro = useMemo(
    () => allSessions.filter((s) => extractPyroSources(s).length > 0),
    [allSessions]
  );

  const { query, setQuery, filtered } = useSessionFilter(sessionsWithPyro);

  // Pre-compute pyro sources for each session
  const sourcesBySession = useMemo(() => {
    const map = new Map<string, PyroDataSource[]>();
    for (const s of filtered) {
      map.set(s.id, extractPyroSources(s));
    }
    return map;
  }, [filtered]);

  // All selectable sources (for the current filtered set)
  const allSources = useMemo(
    () => Array.from(sourcesBySession.values()).flat(),
    [sourcesBySession]
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const toggleSource = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(allSources.map((s) => s.id)));
  }, [allSources]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    const selected = allSources.filter((s) => selectedIds.has(s.id));
    onSelect(selected);
    onClose();
  }, [allSources, selectedIds, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Pick Pyrometer Readings"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            Pick Pyrometer Readings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <SearchFilterBar
            query={query}
            onChange={setQuery}
            resultCount={filtered.length}
            totalCount={sessionsWithPyro.length}
            placeholder="Filter sessions by date, vehicle, location, compound, notes…"
          />
        </div>

        {/* Selection controls */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <span className="text-xs text-gray-500">
            {selectedIds.size} reading(s) selected
          </span>
          <div className="flex gap-2">
            <button onClick={selectAllVisible} className="text-[10px] text-[#00d4aa] hover:text-[#00d4aa]/80">
              Select all visible
            </button>
            <button onClick={clearSelection} className="text-[10px] text-gray-500 hover:text-gray-300">
              Clear
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading sessions...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              {query
                ? "No sessions with pyro data match your search."
                : "No sessions with pyrometer readings found."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((session) => {
                const sources = sourcesBySession.get(session.id) ?? [];
                const isCurrent = session.id === currentSessionId;

                return (
                  <div
                    key={session.id}
                    className="border border-gray-700 rounded overflow-hidden"
                  >
                    {/* Session row */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                      onClick={() =>
                        setExpandedSession(
                          expandedSession === session.id ? null : session.id
                        )
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {session.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-[#00d4aa]/20 text-[#00d4aa] px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {session.trackName && <span>{session.trackName}</span>}
                          {session.vehicle && <span>{session.vehicle}</span>}
                          {session.date && (
                            <span>{new Date(session.date).toLocaleDateString()}</span>
                          )}
                          {session.compoundPreset && (
                            <span>{session.compoundPreset}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {sources.length} reading{sources.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-500">
                          {expandedSession === session.id ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>

                    {/* Expanded readings */}
                    {expandedSession === session.id && (
                      <div className="border-t border-gray-700">
                        {sources.map((src) => (
                          <label
                            key={src.id}
                            className="flex items-center gap-3 px-3 py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-800/30 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(src.id)}
                              onChange={() => toggleSource(src.id)}
                              className="accent-[#00d4aa] w-4 h-4 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-300 font-medium">
                                {src.type === "pitstop" ? "🏁 " : "🌡 "}
                                {src.label}
                              </div>
                              {src.notes && (
                                <div className="text-[10px] text-gray-500 italic truncate">
                                  {src.notes}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
            Load {selectedIds.size} Reading{selectedIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
