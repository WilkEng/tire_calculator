"use client";

import { useState, useCallback, useMemo } from "react";
import type { Session } from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

export interface SessionFilterCriteria {
  query: string;
  /** Any additional active filter fields */
}

/**
 * Filters a list of sessions by matching the query against
 * date, vehicle, location, track, compound, notes, and stint names.
 */
export function filterSessions(
  sessions: Session[],
  criteria: SessionFilterCriteria
): Session[] {
  const q = criteria.query.trim().toLowerCase();
  if (!q) return sessions;

  return sessions.filter((s) => {
    // Date (both ISO and formatted)
    if (s.date?.toLowerCase().includes(q)) return true;
    if (s.date) {
      try {
        const formatted = new Date(s.date).toLocaleDateString().toLowerCase();
        if (formatted.includes(q)) return true;
      } catch { /* ignore */ }
    }

    // Track / name
    if (s.name?.toLowerCase().includes(q)) return true;
    if (s.trackName?.toLowerCase().includes(q)) return true;

    // Vehicle
    if (s.vehicle?.toLowerCase().includes(q)) return true;

    // Location
    if (s.location?.toLowerCase().includes(q)) return true;

    // Compound
    if (s.compoundPreset?.toLowerCase().includes(q)) return true;

    // Notes
    if (s.notes?.toLowerCase().includes(q)) return true;

    // Stint names & notes
    if (
      s.stints?.some(
        (st) =>
          st.name?.toLowerCase().includes(q) ||
          st.baseline?.compound?.toLowerCase().includes(q) ||
          st.pitstops?.some((p) => p.notes?.toLowerCase().includes(q))
      )
    )
      return true;

    return false;
  });
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useSessionFilter(sessions: Session[]) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterSessions(sessions, { query }),
    [sessions, query]
  );

  const clearFilter = useCallback(() => setQuery(""), []);

  return { query, setQuery, filtered, clearFilter };
}

// ─── Component ─────────────────────────────────────────────────────

interface SearchFilterBarProps {
  query: string;
  onChange: (query: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

export function SearchFilterBar({
  query,
  onChange,
  placeholder = "Search by date, vehicle, location, compound, notes…",
  resultCount,
  totalCount,
  className = "",
}: SearchFilterBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-600 rounded pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent placeholder-gray-500"
        />
        {query && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      {resultCount != null && totalCount != null && query && (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {resultCount}/{totalCount}
        </span>
      )}
    </div>
  );
}
