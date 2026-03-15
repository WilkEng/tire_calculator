"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { getAllSessions } from "@/lib/persistence/db";
import type { Session, Stint, StintBaseline, Corner } from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

interface BaselinePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (baseline: StintBaseline, sessionName: string, stintName: string) => void;
  pressureUnit: string;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

// ─── Component ─────────────────────────────────────────────────────

export function BaselinePickerModal({
  open,
  onClose,
  onSelect,
  pressureUnit,
}: BaselinePickerModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // Load sessions from IndexedDB when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getAllSessions()
      .then((list) => {
        setSessions(list);
        setExpandedSession(null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSelectStint = useCallback(
    (session: Session, stint: Stint) => {
      onSelect(stint.baseline, session.name, stint.name);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!open) return null;

  // Group sessions by track
  const byTrack = new Map<string, Session[]>();
  for (const s of sessions) {
    const track = s.trackName || "Unknown Track";
    if (!byTrack.has(track)) byTrack.set(track, []);
    byTrack.get(track)!.push(s);
  }

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
        aria-label="Pick Baseline from History"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">
            Pick Baseline from History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No saved sessions found. Export a baseline first.
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(byTrack.entries()).map(([track, trackSessions]) => (
                <div key={track}>
                  <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    {track}
                  </h3>
                  <div className="space-y-2">
                    {trackSessions.map((session) => (
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
                          <div>
                            <span className="text-sm font-medium text-gray-200">
                              {session.name}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {session.date
                                ? new Date(session.date).toLocaleDateString()
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {session.stints?.length ?? 0} stint
                              {(session.stints?.length ?? 0) !== 1 ? "s" : ""}
                            </span>
                            <span className="text-gray-500">
                              {expandedSession === session.id ? "▾" : "▸"}
                            </span>
                          </div>
                        </button>

                        {/* Expanded stints */}
                        {expandedSession === session.id && (
                          <div className="border-t border-gray-700">
                            {session.stints?.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-500">
                                No stints in this session.
                              </p>
                            ) : (
                              session.stints?.map((stint) => (
                                <div
                                  key={stint.id}
                                  className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-800/30"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-300 font-medium">
                                      {stint.name}
                                    </div>
                                    <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                                      <span>
                                        Mode: {stint.baseline.targetMode}
                                      </span>
                                      {stint.baseline.ambientMeasured != null && (
                                        <span>
                                          Amb: {stint.baseline.ambientMeasured}°
                                        </span>
                                      )}
                                      {stint.baseline.asphaltMeasured != null && (
                                        <span>
                                          Asp: {stint.baseline.asphaltMeasured}°
                                        </span>
                                      )}
                                    </div>
                                    {/* Cold pressures summary */}
                                    {stint.baseline.coldPressures &&
                                      Object.keys(stint.baseline.coldPressures).length > 0 && (
                                        <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                                          {CORNERS.map((c) => (
                                            <span key={c} className="tabular-nums">
                                              {c}:{" "}
                                              {stint.baseline.coldPressures?.[c]?.toFixed(3) ??
                                                "—"}
                                            </span>
                                          ))}
                                          <span className="text-gray-600">
                                            {pressureUnit}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      handleSelectStint(session, stint)
                                    }
                                  >
                                    Use
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
