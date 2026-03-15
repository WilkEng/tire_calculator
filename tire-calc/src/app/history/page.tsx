"use client";

import { useState, useEffect } from "react";
import { useEventContext } from "@/context/EventContext";
import { getAllEvents, clearHistory, deleteEvent } from "@/lib/persistence/db";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchFilterBar, useEventFilter } from "@/components/ui/SearchFilterBar";
import Link from "next/link";
import type { Event } from "@/lib/domain/models";

export default function HistoryPage() {
  const { setEvent } = useEventContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to delete all history?")) return;
    await clearHistory();
    setEvents([]);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await deleteEvent(id);
    await loadEvents();
  };

  const handleLoadEvent = (s: Event) => {
    setEvent(s);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-xl font-bold text-gray-100">Event History</h1>
        <Button variant="secondary" onClick={handleClearHistory}>
          Clear History
        </Button>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : events.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-400 mb-4">No saved events yet.</p>
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
            totalCount={events.length}
          />

          {filtered.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No events match your search.</p>
          ) : (
            <div className="grid gap-4">
              {filtered.map((s) => (
                <Card key={s.id} className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-200">
                      {s.name || "Unnamed Event"}
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
                        onClick={() => handleLoadEvent(s)}
                      >
                        Load into active
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => handleDeleteEvent(s.id)}
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
