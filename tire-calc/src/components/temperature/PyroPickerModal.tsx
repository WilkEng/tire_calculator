"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar, useEventFilter } from "@/components/ui/SearchFilterBar";
import { getAllEvents } from "@/lib/persistence/db";
import type {
  Event,
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
  eventName: string;
  eventDate?: string;
  vehicle?: string;
  location?: string;
  compound?: string;
}

interface PyroPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (sources: PyroDataSource[]) => void;
  /** Currently active event ID (to label it separately) */
  currentEventId?: string;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

function hasPyroData(readings: Partial<FourCornerTemperatureReadings> | undefined): boolean {
  if (!readings) return false;
  return CORNERS.some((c) => {
    const r = readings[c] as CornerTemperatureReading | undefined;
    return r && (r.inner || r.middle || r.outer);
  });
}

/** Extract all pyro data sources from an event */
function extractPyroSources(evt: Event): PyroDataSource[] {
  const sources: PyroDataSource[] = [];

  // Temperature runs
  for (let i = 0; i < evt.temperatureRuns.length; i++) {
    const run = evt.temperatureRuns[i];
    if (hasPyroData(run.readings)) {
      sources.push({
        id: `${evt.id}-run-${run.id}`,
        label: `Run ${i + 1}${run.setupTag ? ` (${run.setupTag})` : ""}`,
        type: "run",
        readings: run.readings,
        notes: run.notes || undefined,
        eventName: evt.name,
        eventDate: evt.date,
        vehicle: evt.vehicle,
        location: evt.location,
        compound: evt.compoundPreset,
      });
    }
  }

  // Pitstops with temperature readings
  for (const stint of evt.stints) {
    for (const pit of stint.pitstops) {
      if (hasPyroData(pit.temperatureReadings)) {
        sources.push({
          id: `${evt.id}-pit-${pit.id}`,
          label: `${stint.name} P${pit.index}`,
          type: "pitstop",
          readings: pit.temperatureReadings!,
          notes: pit.notes || undefined,
          eventName: evt.name,
          eventDate: evt.date,
          vehicle: evt.vehicle,
          location: evt.location,
          compound: evt.compoundPreset,
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
  currentEventId,
}: PyroPickerModalProps) {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEvent, setExpandedSession] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load events from IndexedDB when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedIds(new Set());
    setExpandedSession(null);
    getAllEvents()
      .then(setAllEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  // Filter events to those with pyro data
  const eventsWithPyro = useMemo(
    () => allEvents.filter((s) => extractPyroSources(s).length > 0),
    [allEvents]
  );

  const { query, setQuery, filtered } = useEventFilter(eventsWithPyro);

  // Pre-compute pyro sources for each event
  const sourcesByEvent = useMemo(() => {
    const map = new Map<string, PyroDataSource[]>();
    for (const s of filtered) {
      map.set(s.id, extractPyroSources(s));
    }
    return map;
  }, [filtered]);

  // All selectable sources (for the current filtered set)
  const allSources = useMemo(
    () => Array.from(sourcesByEvent.values()).flat(),
    [sourcesByEvent]
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
            totalCount={eventsWithPyro.length}
            placeholder="Filter events by date, vehicle, location, compound, notes…"
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
            <p className="text-gray-400 text-center py-8">Loading events...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              {query
                ? "No events with pyro data match your search."
                : "No events with pyrometer readings found."}
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((evt) => {
                const sources = sourcesByEvent.get(evt.id) ?? [];
                const isCurrent = evt.id === currentEventId;

                return (
                  <div
                    key={evt.id}
                    className="border border-gray-700 rounded overflow-hidden"
                  >
                    {/* Event row */}
                    <button
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
                      onClick={() =>
                        setExpandedSession(
                          expandedEvent === evt.id ? null : evt.id
                        )
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {evt.name}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-[#00d4aa]/20 text-[#00d4aa] px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {evt.trackName && <span>{evt.trackName}</span>}
                          {evt.vehicle && <span>{evt.vehicle}</span>}
                          {evt.date && (
                            <span>{new Date(evt.date).toLocaleDateString()}</span>
                          )}
                          {evt.compoundPreset && (
                            <span>{evt.compoundPreset}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">
                          {sources.length} reading{sources.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-gray-500">
                          {expandedEvent === evt.id ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>

                    {/* Expanded readings */}
                    {expandedEvent === evt.id && (
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
