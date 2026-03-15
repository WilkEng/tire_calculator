"use client";

import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";
import type { Session } from "@/lib/domain/models";

interface SessionHeaderProps {
  session: Session;
  onUpdate: (updates: Partial<Session>) => void;
}

export function SessionHeader({ session, onUpdate }: SessionHeaderProps) {
  return (
    <Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Session Name
          </span>
          <input
            type="text"
            value={session.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            placeholder="e.g. FP1 Saturday"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Track
          </span>
          <input
            type="text"
            value={session.trackName}
            onChange={(e) => onUpdate({ trackName: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            placeholder="e.g. Spa-Francorchamps"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Date
          </span>
          <input
            type="date"
            value={session.date}
            onChange={(e) => onUpdate({ date: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
          />
        </label>
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Location
          </span>
          <input
            type="text"
            value={session.location ?? ""}
            onChange={(e) => onUpdate({ location: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            placeholder="City, Country"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Compound / Tire Preset
          </span>
          <input
            type="text"
            value={session.compoundPreset ?? ""}
            onChange={(e) => onUpdate({ compoundPreset: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            placeholder="e.g. Pirelli Medium"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Notes
          </span>
          <input
            type="text"
            value={session.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className="
              bg-gray-800 border border-gray-600 rounded px-3 py-2
              text-sm text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
            placeholder="Session notes..."
          />
        </label>
      </div>
    </Card>
  );
}
