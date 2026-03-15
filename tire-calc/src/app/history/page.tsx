"use client";

import { useState, useEffect } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { getAllSessions, clearHistory, deleteSession } from "@/lib/persistence/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar, useSessionFilter } from "@/components/ui/SearchFilterBar";
import Link from "next/link";
import type { Session } from "@/lib/domain/models";

export default function HistoryPage() {
  const { setSession } = useSessionContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const data = await getAllSessions();
      setSessions(data.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const { query, setQuery, filtered } = useSessionFilter(sessions);

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to delete all history?")) return;
    await clearHistory();
    setSessions([]);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    await deleteSession(id);
    await loadSessions();
  };

  const handleLoadSession = (s: Session) => {
    setSession(s);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-100">Session History</h1>
        <Button variant="secondary" onClick={handleClearHistory}>
          Clear History
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">No saved sessions yet.</p>
            <Link href="/planner">
              <Button>Start Planner</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <SearchFilterBar
            query={query}
            onChange={setQuery}
            resultCount={filtered.length}
            totalCount={sessions.length}
          />

          {filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No sessions match your search.</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((s) => (
                <Card key={s.id} className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-200">
                      {s.name || "Unnamed Session"}
                    </h3>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>Track: {s.trackName || "Unknown"}</p>
                      {s.vehicle && <p>Vehicle: {s.vehicle}</p>}
                      {s.location && <p>Location: {s.location}</p>}
                      <p>{s.date ? new Date(s.date).toLocaleDateString() : "No date"}</p>
                      {s.compoundPreset && <p>Compound: {s.compoundPreset}</p>}
                      <span>{s.stints?.length ?? 0} stint(s), {s.stints?.flatMap(st => st.pitstops).length ?? 0} pitstop(s)</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <Link href="/planner">
                      <Button
                        className="w-full"
                        onClick={() => handleLoadSession(s)}
                      >
                        Load into active
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleDeleteSession(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
