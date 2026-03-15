"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { searchLocation, getUserLocation } from "@/lib/weather/openMeteo";

// ─── Types ─────────────────────────────────────────────────────────

export interface NewSessionData {
  name: string;
  trackName: string;
  date: string;
  location: string;
  latitude?: number;
  longitude?: number;
  compoundPreset: string;
  notes: string;
}

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewSessionData) => void;
}

// ─── Common compound presets ───────────────────────────────────────

const COMPOUND_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "Soft", label: "Soft" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Wet", label: "Wet" },
];

// ─── Component ─────────────────────────────────────────────────────

export function NewSessionModal({ open, onClose, onSubmit }: NewSessionModalProps) {
  const [name, setName] = useState("New Session");
  const [trackName, setTrackName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [compoundPreset, setCompoundPreset] = useState("");
  const [notes, setNotes] = useState("");

  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState<
    { name: string; latitude: number; longitude: number; country: string }[]
  >([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setName("New Session");
      setTrackName("");
      setDate(new Date().toISOString().slice(0, 10));
      setLocation("");
      setLatitude(undefined);
      setLongitude(undefined);
      setCompoundPreset("");
      setNotes("");
      setLocationQuery("");
      setLocationResults([]);
    }
  }, [open]);

  // Focus trap — close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Location search with debounce
  const handleLocationSearch = useCallback((query: string) => {
    setLocationQuery(query);
    setLocation(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setLocationResults([]);
      setShowLocationDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(query);
        setLocationResults(results);
        setShowLocationDropdown(results.length > 0);
      } catch {
        setLocationResults([]);
      }
    }, 300);
  }, []);

  const handleSelectLocation = useCallback(
    (result: { name: string; latitude: number; longitude: number; country: string }) => {
      setLocation(`${result.name}, ${result.country}`);
      setLocationQuery(`${result.name}, ${result.country}`);
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setShowLocationDropdown(false);
      // Auto-fill track name if empty
      if (!trackName) setTrackName(result.name);
    },
    [trackName]
  );

  const handleDetectLocation = useCallback(async () => {
    setDetectingLocation(true);
    try {
      const pos = await getUserLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setLocation(`${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`);
      setLocationQuery(`${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`);
    } catch (e) {
      alert("Could not detect location: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDetectingLocation(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      trackName: trackName.trim(),
      date,
      location: location.trim(),
      latitude,
      longitude,
      compoundPreset,
      notes: notes.trim(),
    });
    onClose();
  }, [name, trackName, date, location, latitude, longitude, compoundPreset, notes, onSubmit, onClose]);

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
        ref={modalRef}
        className="relative z-10 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="New Session"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">New Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Session Name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Session Name *
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FP1, Qualifying, Race Day"
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
              autoFocus
            />
          </label>

          {/* Track Name */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Track Name
            </span>
            <input
              type="text"
              value={trackName}
              onChange={(e) => setTrackName(e.target.value)}
              placeholder="e.g. Spa-Francorchamps"
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
            />
          </label>

          {/* Date */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </label>

          {/* Location with search */}
          <div className="relative">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                Location
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationQuery || location}
                  onChange={(e) => handleLocationSearch(e.target.value)}
                  onFocus={() => locationResults.length > 0 && setShowLocationDropdown(true)}
                  placeholder="Search city or track..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="whitespace-nowrap"
                >
                  {detectingLocation ? "..." : "📍 GPS"}
                </Button>
              </div>
            </label>

            {/* Location dropdown */}
            {showLocationDropdown && (
              <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                {locationResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                    onClick={() => handleSelectLocation(r)}
                  >
                    {r.name}, {r.country}
                    <span className="text-xs text-gray-500 ml-2">
                      ({r.latitude.toFixed(2)}, {r.longitude.toFixed(2)})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {latitude != null && longitude != null && (
              <p className="text-xs text-gray-500 mt-1">
                Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </p>
            )}
          </div>

          {/* Tire Compound */}
          <Select
            label="Tire Compound"
            value={compoundPreset}
            onChange={setCompoundPreset}
            options={COMPOUND_OPTIONS}
          />

          {/* Notes */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Setup notes, conditions, etc."
              rows={3}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 resize-y"
            />
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Create Session
          </Button>
        </div>
      </div>
    </div>
  );
}
