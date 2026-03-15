"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ComboBox } from "@/components/ui/ComboBox";
import type { ComboBoxOption } from "@/components/ui/ComboBox";
import { searchLocation, getUserLocation } from "@/lib/weather/openMeteo";
import { getAllSessions } from "@/lib/persistence/db";
import type { Session } from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

export interface NewSessionData {
  name: string;
  trackName: string;
  date: string;
  vehicle: string;
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
  const [vehicle, setVehicle] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [compoundPreset, setCompoundPreset] = useState("");
  const [notes, setNotes] = useState("");

  // Location search state (API results)
  const [locationApiResults, setLocationApiResults] = useState<
    { name: string; latitude: number; longitude: number; country: string }[]
  >([]);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // History from saved sessions
  const [historySessions, setHistorySessions] = useState<Session[]>([]);

  // Load saved sessions when modal opens
  useEffect(() => {
    if (!open) return;
    getAllSessions()
      .then(setHistorySessions)
      .catch(console.error);
  }, [open]);

  // Build unique location options from history (with coordinates)
  const locationHistoryOptions: ComboBoxOption[] = useMemo(() => {
    const map = new Map<string, { lat?: number; lng?: number }>();
    for (const s of historySessions) {
      const loc = s.location?.trim();
      if (loc) {
        // Keep the first occurrence's coordinates (most recent session sorted first)
        if (!map.has(loc)) {
          map.set(loc, { lat: s.latitude, lng: s.longitude });
        }
      }
    }
    return Array.from(map.entries()).map(([loc, coords]) => ({
      label: loc,
      description:
        coords.lat != null && coords.lng != null
          ? `(${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`
          : undefined,
      meta: { latitude: coords.lat, longitude: coords.lng },
    }));
  }, [historySessions]);

  // Build unique vehicle options from history
  const vehicleHistoryOptions: ComboBoxOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const s of historySessions) {
      const v = s.vehicle?.trim();
      if (v) set.add(v);
    }
    return Array.from(set).map((v) => ({ label: v }));
  }, [historySessions]);

  // Merge history locations with API search results for the ComboBox
  const locationOptions: ComboBoxOption[] = useMemo(() => {
    const opts = [...locationHistoryOptions];
    // Add API results as additional options
    for (const r of locationApiResults) {
      const label = `${r.name}, ${r.country}`;
      if (!opts.some((o) => o.label === label)) {
        opts.push({
          label,
          description: `(${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)})`,
          meta: { latitude: r.latitude, longitude: r.longitude },
        });
      }
    }
    return opts;
  }, [locationHistoryOptions, locationApiResults]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setName("New Session");
      setTrackName("");
      setDate(new Date().toISOString().slice(0, 10));
      setVehicle("");
      setLocation("");
      setLatitude(undefined);
      setLongitude(undefined);
      setCompoundPreset("");
      setNotes("");
      setLocationApiResults([]);
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

  // Debounced API search when location text changes
  const handleLocationChange = useCallback((query: string) => {
    setLocation(query);
    // Clear coordinates when user types a new location
    setLatitude(undefined);
    setLongitude(undefined);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setLocationApiResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocation(query);
        setLocationApiResults(results);
      } catch {
        setLocationApiResults([]);
      }
    }, 300);
  }, []);

  // When a location option is selected from the dropdown
  const handleLocationSelect = useCallback(
    (option: ComboBoxOption) => {
      setLocation(option.label);
      const lat = option.meta?.latitude as number | undefined;
      const lng = option.meta?.longitude as number | undefined;
      if (lat != null && lng != null) {
        setLatitude(lat);
        setLongitude(lng);
      }
      // Auto-fill track name if empty
      if (!trackName) {
        const trackPart = option.label.split(",")[0].trim();
        setTrackName(trackPart);
      }
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
      vehicle: vehicle.trim(),
      location: location.trim(),
      latitude,
      longitude,
      compoundPreset,
      notes: notes.trim(),
    });
    onClose();
  }, [name, trackName, date, vehicle, location, latitude, longitude, compoundPreset, notes, onSubmit, onClose]);

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
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent placeholder-gray-500"
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
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent placeholder-gray-500"
            />
          </label>

          {/* Vehicle (ComboBox with history) */}
          <ComboBox
            label="Vehicle"
            value={vehicle}
            onChange={setVehicle}
            options={vehicleHistoryOptions}
            placeholder="e.g. Mazda MX-5, Porsche 911 GT3"
          />

          {/* Date */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent"
            />
          </label>

          {/* Location (ComboBox with history + API search) */}
          <div>
            <ComboBox
              label="Location"
              value={location}
              onChange={handleLocationChange}
              onSelect={handleLocationSelect}
              options={locationOptions}
              placeholder="Search city or track..."
              actionButton={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="whitespace-nowrap"
                >
                  {detectingLocation ? "..." : "📍 GPS"}
                </Button>
              }
            />
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
              className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00d4aa]/50 focus:border-transparent placeholder-gray-500 resize-y"
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
