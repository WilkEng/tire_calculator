"use client";

import { useMemo, useCallback, useState } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { Button } from "@/components/ui/Button";
import { NumericInput } from "@/components/ui/NumericInput";
import { Card } from "@/components/ui/Card";
import { PitstopCard } from "@/components/planner/PitstopCard";
import { RecommendationPanel } from "@/components/planner/RecommendationPanel";
import { SessionHeader } from "@/components/planner/SessionHeader";
import { SessionStartCard } from "@/components/planner/SessionStartCard";
import { computeRecommendation, type RecommendationInput } from "@/lib/engine";
import type { RecommendationOutput } from "@/lib/domain/models";

export default function PlannerPage() {
  const {
    session,
    settings,
    createNewSession,
    updateBaseline,
    addPitstop,
    updatePitstop,
    updateHotPressure,
    updateBledPressure,
    resetBledCorner,
    removePitstop,
    updateSession,
  } = useSessionContext();

  // "Next stint conditions" — transient inputs for the engine
  const baseline = session?.baseline;
  const [nextAmbient, setNextAmbient] = useState<number | undefined>(undefined);
  const [nextAsphalt, setNextAsphalt] = useState<number | undefined>(undefined);

  // Create a new session if none exists
  const handleNewSession = useCallback(() => {
    createNewSession("New Session", "");
  }, [createNewSession]);

  // Resolve next-stint conditions: user input → baseline measured → baseline forecast → default
  const resolvedAmbient =
    nextAmbient ?? baseline?.ambientMeasured ?? baseline?.ambientForecast ?? 20;
  const resolvedAsphalt =
    nextAsphalt ?? baseline?.asphaltMeasured ?? baseline?.asphaltForecast ?? 30;

  // Compute recommendation for the latest pitstop
  const recommendation: RecommendationOutput | null = useMemo(() => {
    if (!session || session.pitstops.length < 1) return null;

    const latestPitstop = session.pitstops[session.pitstops.length - 1];

    const input: RecommendationInput = {
      currentSession: session,
      currentPitstopIndex: latestPitstop.index,
      nextConditions: {
        ambientTemp: resolvedAmbient,
        asphaltTemp: resolvedAsphalt,
        startTireTemps: session.baseline?.startTireTemps,
      },
      targetMode: latestPitstop.targetMode,
      targets: latestPitstop.targets,
      priorSessions: [], // TODO: load from DB for cross-session carry-over
      settings,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [session, settings, resolvedAmbient, resolvedAsphalt]);

  // ── No session state ──
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <h1 className="text-2xl font-bold text-gray-200">Pressure Planner</h1>
        <p className="text-gray-400 text-center max-w-md">
          Start a new session to begin logging pitstop data and calculating tire
          pressures.
        </p>
        <Button size="lg" onClick={handleNewSession}>
          + New Session
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Pressure Planner</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleNewSession}>
            New Session
          </Button>
        </div>
      </div>

      {/* ── Session Header ── */}
      <SessionHeader session={session} onUpdate={updateSession} />

      {/* ── Session Start Baseline ── */}
      <SessionStartCard
        baseline={session.baseline ?? {}}
        onUpdate={updateBaseline}
        pressureUnit={settings.unitsPressure}
        temperatureUnit={settings.unitsTemperature}
      />

      {/* ── Next Stint Conditions (engine input) ── */}
      <Card title="Next Stint Conditions" className="border-indigo-800">
        <p className="text-xs text-gray-500 mb-3">
          Override forecast/baseline conditions for the upcoming stint.
          Leave blank to use session baseline values.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumericInput
            label="Ambient"
            unit={`°${settings.unitsTemperature}`}
            value={nextAmbient}
            onChange={setNextAmbient}
          />
          <NumericInput
            label="Asphalt"
            unit={`°${settings.unitsTemperature}`}
            value={nextAsphalt}
            onChange={setNextAsphalt}
          />
          <div className="col-span-2 flex items-end">
            <p className="text-xs text-gray-500">
              Using: {resolvedAmbient}° ambient / {resolvedAsphalt}° asphalt
            </p>
          </div>
        </div>
      </Card>

      {/* ── Recommendation Panel ── */}
      <RecommendationPanel
        recommendation={recommendation}
        pressureUnit={settings.unitsPressure}
      />

      {/* ── Pitstop Timeline ── */}
      <div className="space-y-4">
        {session.pitstops.map((pitstop) => (
          <PitstopCard
            key={pitstop.id}
            pitstop={pitstop}
            onUpdate={(updates) => updatePitstop(pitstop.index, updates)}
            onHotPressureChange={(corner, val) =>
              updateHotPressure(pitstop.index, corner, val)
            }
            onBledPressureChange={(corner, val) =>
              updateBledPressure(pitstop.index, corner, val)
            }
            onResetBledCorner={(corner) =>
              resetBledCorner(pitstop.index, corner)
            }
            onRemove={() => removePitstop(pitstop.index)}
            isLatest={pitstop.index === session.pitstops.length}
            pressureUnit={settings.unitsPressure}
            temperatureUnit={settings.unitsTemperature}
          />
        ))}
      </div>

      {/* ── Add Pitstop ── */}
      <div className="flex justify-center">
        <Button variant="secondary" onClick={addPitstop}>
          + Add Pitstop {session.pitstops.length + 1}
        </Button>
      </div>
    </div>
  );
}
