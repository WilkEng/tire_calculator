"use client";

import { Card } from "@/components/ui/Card";
import type { Session } from "@/lib/domain/models";

interface SessionStartCardProps {
  session: Session;
  onUpdate: (updates: Partial<Session>) => void;
}

export function SessionStartCard({
  session,
  onUpdate,
}: SessionStartCardProps) {
  return (
    <Card title="Session Setup">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-300">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Track Name
            </span>
            <input
              type="text"
              value={session.trackName}
              onChange={(e) => onUpdate({ trackName: e.target.value })}
              className="bg-gray-800 border fill-gray-800 border-gray-600 rounded px-3 py-1.5 focus:border-[#00d4aa]/50 focus:outline-none"
              placeholder="e.g. Spa-Francorchamps"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-300">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              Compound Preset
            </span>
            <input
              type="text"
              value={session.compoundPreset || ""}
              onChange={(e) => onUpdate({ compoundPreset: e.target.value })}
              className="bg-gray-800 border fill-gray-800 border-gray-600 rounded px-3 py-1.5 focus:border-[#00d4aa]/50 focus:outline-none"
              placeholder="e.g. Slick (Medium)"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-gray-300">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Notes
          </span>
          <textarea
            value={session.notes || ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className="bg-gray-800 border fill-gray-800 border-gray-600 rounded px-3 py-1.5 focus:border-[#00d4aa]/50 focus:outline-none min-h-[60px]"
            placeholder="Track conditions, goals..."
          />
        </label>
      </div>
    </Card>
  );
}
