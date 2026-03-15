"use client";

import { useState, useEffect, useCallback } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  getAllSessions,
  deleteSession as dbDeleteSession,
  saveSession,
  replaceAllSessions,
  loadSettings,
  saveSettings,
} from "@/lib/persistence/db";
import {
  exportSession,
  exportFullBackup,
  importSession,
  importFullBackup,
  exportSessionCSV,
  toJSON,
  downloadJSON,
  downloadCSV,
  readFileAsText,
} from "@/lib/io/importExport";
import type { Session } from "@/lib/domain/models";
import { createSession } from "@/lib/domain/factories";

export default function HistoryPage() {
  const { session: activeSession, setSession, settings } = useSessionContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState<string>("");

  const loadSessions = useCallback(async () => {
    const all = await getAllSessions();
    setSessions(all);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 4000);
  };

  // ── Open session ──
  const handleOpen = (s: Session) => {
    setSession(s);
    showMessage(`Loaded session: ${s.name}`);
  };

  // ── Clone session ──
  const handleClone = async (s: Session) => {
    const cloned = createSession({
      name: `${s.name} (copy)`,
      trackName: s.trackName,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      pitstops: [],
      weatherSnapshots: [],
      temperatureRuns: [],
      recommendationHistory: [],
      notes: s.notes,
      setupTags: s.setupTags,
      compoundPreset: s.compoundPreset,
    });
    await saveSession(cloned);
    await loadSessions();
    showMessage(`Cloned session: ${cloned.name}`);
  };

  // ── Delete session ──
  const handleDelete = async (s: Session) => {
    if (!confirm(`Delete session "${s.name}"? This cannot be undone.`)) return;
    await dbDeleteSession(s.id);
    // If it was the active session, clear it
    if (activeSession?.id === s.id) {
      setSession(null as unknown as Session); // clear
    }
    await loadSessions();
    showMessage(`Deleted session: ${s.name}`);
  };

  // ── Export single session ──
  const handleExportSession = (s: Session) => {
    const data = exportSession(s);
    const json = toJSON(data);
    const filename = `tire-calc-session-${s.name.replace(/\s+/g, "-")}-${s.date}.json`;
    downloadJSON(json, filename);
    showMessage(`Exported: ${filename}`);
  };

  // ── Export full backup ──
  const handleExportBackup = async () => {
    const all = await getAllSessions();
    const currentSettings = await loadSettings();
    const data = exportFullBackup(all, currentSettings);
    const json = toJSON(data);
    const filename = `tire-calc-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJSON(json, filename);
    showMessage(`Exported full backup: ${filename}`);
  };

  // ── CSV export ──
  const handleExportCSV = (s: Session) => {
    const csv = exportSessionCSV(s);
    const filename = `tire-calc-session-${s.name.replace(/\s+/g, "-")}-${s.date}.csv`;
    downloadCSV(csv, filename);
    showMessage(`Exported CSV: ${filename}`);
  };

  // ── Import ──
  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await readFileAsText(file);

      // Try session import first
      const sessionResult = importSession(text);
      if (sessionResult.success && sessionResult.session) {
        await saveSession(sessionResult.session);
        await loadSessions();
        showMessage(
          `Imported session: ${sessionResult.session.name}` +
            (sessionResult.warnings.length > 0
              ? ` (${sessionResult.warnings.join("; ")})`
              : "")
        );
        return;
      }

      // Try full backup import
      const backupResult = importFullBackup(text);
      if (backupResult.success && backupResult.sessions && backupResult.settings) {
        await replaceAllSessions(backupResult.sessions);
        await saveSettings(backupResult.settings);
        await loadSessions();
        showMessage(
          `Imported full backup: ${backupResult.sessions.length} sessions` +
            (backupResult.warnings.length > 0
              ? ` (${backupResult.warnings.join("; ")})`
              : "")
        );
        return;
      }

      // Show errors
      const errors = [
        ...(sessionResult.errors ?? []),
        ...(backupResult.errors ?? []),
      ];
      showMessage(`Import failed: ${errors.join("; ")}`);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Data & History</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleImport}>
            Import JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportBackup}>
            Export Full Backup
          </Button>
        </div>
      </div>

      {message && (
        <div className="bg-blue-900/40 border border-blue-700 rounded px-4 py-2 text-sm text-blue-200">
          {message}
        </div>
      )}

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-8">
            No saved sessions. Create one from the Planner or import a file.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className={activeSession?.id === s.id ? "ring-1 ring-blue-500" : ""}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-200 truncate">
                      {s.name || "Unnamed Session"}
                    </h3>
                    {activeSession?.id === s.id && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                    <span>{s.trackName || "No track"}</span>
                    <span>{s.date}</span>
                    <span>{s.pitstops.length} pitstop(s)</span>
                    {s.compoundPreset && <span>{s.compoundPreset}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" onClick={() => handleOpen(s)}>
                    Open
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleClone(s)}
                  >
                    Clone
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportSession(s)}
                  >
                    JSON
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportCSV(s)}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(s)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
