"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useEventContext } from "@/context/EventContext";
import { getAllEvents, clearHistory, deleteEvent, saveEvent } from "@/lib/persistence/db";
import {
  exportEvent,
  toJSON,
  downloadJSON,
  importEvent,
  readFileAsText,
} from "@/lib/io";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar, useEventFilter } from "@/components/ui/SearchFilterBar";
import Link from "next/link";
import type { Event } from "@/lib/domain/models";

// ─── Preview Modal ─────────────────────────────────────────────────

function PreviewModal({
  event,
  onClose,
}: {
  event: Event;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-bold text-gray-100 truncate">
            {event.name || "Unnamed Event"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-gray-400">
            <Row label="Track" value={event.trackName} />
            <Row label="Date" value={event.date ? new Date(event.date).toLocaleDateString() : "—"} />
            {event.vehicle && <Row label="Vehicle" value={event.vehicle} />}
            {event.location && <Row label="Location" value={event.location} />}
          </div>

          {/* Stints summary */}
          {event.stints?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Stints ({event.stints.length})
              </h4>
              <div className="space-y-2">
                {event.stints.map((stint, idx) => (
                  <div
                    key={stint.id}
                    className="bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2"
                  >
                    <div className="text-gray-200 font-medium text-xs">
                      {stint.name || `Stint ${idx + 1}`}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {stint.pitstops?.length ?? 0} pitstop(s)
                      {stint.baseline?.compound && <> · {stint.baseline.compound}</>}
                      {stint.baseline?.targetMode && <> · {stint.baseline.targetMode}</>}
                    </div>
                    {/* Pitstop cold pressures */}
                    {stint.pitstops?.map((pit, pIdx) => {
                      const recs = pit.recommendationOutput?.recommendedColdPressures;
                      const hasRec = recs && Object.keys(recs).length > 0;
                      return (
                        <div key={pit.id} className="mt-1.5 pl-2 border-l border-gray-700/40">
                          <div className="text-[10px] text-gray-500">
                            Pitstop {pIdx + 1}
                            {hasRec && (
                              <span className="ml-2 text-[#00d4aa]">
                                Rec: {(["FL", "FR", "RL", "RR"] as const).map((c) =>
                                  recs[c] != null ? recs[c]!.toFixed(2) : "—"
                                ).join(" / ")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Temperature runs */}
          {event.temperatureRuns?.length > 0 && (
            <div className="text-xs text-gray-500">
              {event.temperatureRuns.length} temperature run(s)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value ?? "—"}</span>
    </>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: "success" | "error" | "warn"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);
  const bg =
    type === "success"
      ? "bg-emerald-900/80 border-emerald-700/60 text-emerald-200"
      : type === "warn"
      ? "bg-yellow-900/80 border-yellow-700/60 text-yellow-200"
      : "bg-red-900/80 border-red-700/60 text-red-200";
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg border text-sm shadow-lg ${bg}`}>
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════

export default function HistoryPage() {
  const { setEvent } = useEventContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warn" } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadEvents = async () => {
    try {
      const data = await getAllEvents();
      setEvents(data.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const { query, setQuery, filtered } = useEventFilter(events);

  // ── Selection helpers ──

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((e) => e.id));
    });
  }, [filtered]);

  const allSelected = useMemo(
    () => filtered.length > 0 && selected.size === filtered.length,
    [filtered, selected]
  );

  // ── Download selected events ──

  const handleDownloadSelected = useCallback(() => {
    const toDownload = events.filter((e) => selected.has(e.id));
    if (toDownload.length === 0) return;

    for (const evt of toDownload) {
      const payload = exportEvent(evt);
      const json = toJSON(payload);
      const safeName = (evt.name || "event").replace(/[^a-zA-Z0-9_-]/g, "_");
      downloadJSON(json, `tire-calc_${safeName}_${evt.date ?? "nodate"}.json`);
    }
    setToast({ message: `Downloaded ${toDownload.length} event(s)`, type: "success" });
  }, [events, selected]);

  // ── Upload / import events ──

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const existingIds = new Set(events.map((e) => e.id));
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        try {
          const text = await readFileAsText(file);
          const result = importEvent(text);
          if (!result.success || !result.event) {
            errors.push(`${file.name}: ${result.errors.join(", ")}`);
            continue;
          }
          if (existingIds.has(result.event.id)) {
            skipped++;
            continue;
          }
          await saveEvent(result.event);
          existingIds.add(result.event.id);
          imported++;
        } catch (err) {
          errors.push(`${file.name}: ${String(err)}`);
        }
      }

      await loadEvents();

      if (errors.length > 0) {
        setToast({ message: `Errors: ${errors.join("; ")}`, type: "error" });
      } else if (skipped > 0 && imported === 0) {
        setToast({ message: `${skipped} duplicate(s) skipped — already in history`, type: "warn" });
      } else if (skipped > 0) {
        setToast({ message: `Imported ${imported}, skipped ${skipped} duplicate(s)`, type: "warn" });
      } else {
        setToast({ message: `Imported ${imported} event(s)`, type: "success" });
      }

      // Reset file input so re-uploading same file triggers onChange
      if (uploadRef.current) uploadRef.current.value = "";
    },
    [events]
  );

  // ── Delete & clear ──

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to delete all history?")) return;
    await clearHistory();
    setEvents([]);
    setSelected(new Set());
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await deleteEvent(id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await loadEvents();
  };

  const handleLoadEvent = (s: Event) => {
    setEvent(s);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-xl font-bold text-gray-100">Event History</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Upload */}
          <input
            ref={uploadRef}
            type="file"
            accept=".json"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
            ↑ Upload
          </Button>

          {/* Download selected */}
          <Button
            variant="secondary"
            onClick={handleDownloadSelected}
            disabled={selected.size === 0}
          >
            ↓ Download{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>

          <Button variant="secondary" onClick={handleClearHistory}>
            Clear History
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : events.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">No saved events yet.</p>
            <div className="flex justify-center gap-3">
              <Link href="/planner">
                <Button>Start Planner</Button>
              </Link>
              <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
                ↑ Upload Logs
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Search + select-all toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border transition-colors"
              style={{
                borderColor: allSelected ? "#00d4aa" : "#4b5563",
                backgroundColor: allSelected ? "#00d4aa" : "transparent",
              }}
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected && (
                <svg className="w-3 h-3 text-gray-900" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <SearchFilterBar
                query={query}
                onChange={setQuery}
                resultCount={filtered.length}
                totalCount={events.length}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No events match your search.</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <Card
                    key={s.id}
                    className={`flex flex-col sm:flex-row gap-4 justify-between transition-colors ${
                      isSelected ? "!border-[#00d4aa]/50 bg-[#00d4aa]/5" : ""
                    }`}
                  >
                    {/* Checkbox + info */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => toggleOne(s.id)}
                        className="flex-shrink-0 mt-1 flex items-center justify-center w-5 h-5 rounded border transition-colors"
                        style={{
                          borderColor: isSelected ? "#00d4aa" : "#4b5563",
                          backgroundColor: isSelected ? "#00d4aa" : "transparent",
                        }}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-gray-900" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </button>
                      <div>
                        <h3 className="font-semibold text-gray-200">
                          {s.name || "Unnamed Event"}
                        </h3>
                        <div className="text-sm text-gray-400 space-y-1">
                          <p>Track: {s.trackName || "Unknown"}</p>
                          {s.vehicle && <p>Vehicle: {s.vehicle}</p>}
                          {s.location && <p>Location: {s.location}</p>}
                          <p>{s.date ? new Date(s.date).toLocaleDateString() : "No date"}</p>
                          <span>
                            {s.stints?.length ?? 0} stint(s),{" "}
                            {s.stints?.flatMap((st) => st.pitstops).length ?? 0} pitstop(s)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 justify-center">
                      <Link href="/planner">
                        <Button className="w-full" onClick={() => handleLoadEvent(s)}>
                          Load into active
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => setPreviewEvent(s)}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => handleDeleteEvent(s.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      {previewEvent && (
        <PreviewModal event={previewEvent} onClose={() => setPreviewEvent(null)} />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
