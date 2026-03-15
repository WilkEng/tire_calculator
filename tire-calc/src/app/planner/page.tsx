"use client";

import { useMemo, useCallback, useState } from "react";
import { useSessionContext } from "@/context/SessionContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PitstopCard } from "@/components/planner/PitstopCard";
import { RecommendationPanel } from "@/components/planner/RecommendationPanel";
import { SessionHeader } from "@/components/planner/SessionHeader";
import { SessionStartCard } from "@/components/planner/SessionStartCard";
import { NewSessionModal } from "@/components/planner/NewSessionModal";
import type { NewSessionData } from "@/components/planner/NewSessionModal";
import { StintStartFlow } from "@/components/planner/StintStartFlow";
import { BaselinePickerModal } from "@/components/planner/BaselinePickerModal";
import {
  computeRecommendation,
  selectReference,
  expandTargets,
  type RecommendationInput,
} from "@/lib/engine";
import type {
  RecommendationOutput,
  Stint,
  StintBaseline,
  Corner,
} from "@/lib/domain/models";
import { downloadJSON, importStintBaseline } from "@/lib/io/importExport";

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

export default function PlannerPage() {
  const {
    session,
    settings,
    createNewSession,
    closeSession,
    addStint,
    addPitstop,
    updatePitstop,
    updateHotPressure,
    updateBledPressure,
    resetBledCorner,
    removePitstop,
    updateSession,
    updateStintBaseline,
    importBaselineToStint,
    addUserWeatherOverride,
  } = useSessionContext();

  // --- Modal state ---
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [baselinePickerStintId, setBaselinePickerStintId] = useState<
    string | null
  >(null);
  const [collapsedStints, setCollapsedStints] = useState<Set<string>>(
    new Set()
  );

  // --- Create new session from modal ---
  const handleCreateSession = useCallback(
    (data: NewSessionData) => {
      createNewSession({
        name: data.name,
        trackName: data.trackName,
        date: data.date,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        compoundPreset: data.compoundPreset,
        notes: data.notes,
      });
      setShowNewSessionModal(false);
    },
    [createNewSession]
  );

  // --- Export baseline as JSON ---
  const handleExportBaseline = useCallback((stint: Stint) => {
    const exportData = {
      version: 1,
      type: "stint-baseline",
      name: stint.name,
      baseline: stint.baseline,
    };
    const json = JSON.stringify(exportData, null, 2);
    downloadJSON(json, `baseline-${stint.name || "export"}.json`);
  }, []);

  // --- Import baseline from file ---
  const handleImportBaseline = useCallback(
    (stintId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          const result = importStintBaseline(json);
          if (!result.success) {
            alert("Invalid baseline file: " + result.errors.join(", "));
            return;
          }
          importBaselineToStint(
            stintId,
            result.baseline!,
            result.name,
            result.name
          );
        } catch (err) {
          alert("Failed to import baseline: " + String(err));
        }
      };
      reader.readAsText(file);
    },
    [importBaselineToStint]
  );

  // --- Pick baseline from history ---
  const handlePickBaseline = useCallback(
    (baseline: StintBaseline, sessionName: string, stintName: string) => {
      if (!baselinePickerStintId) return;
      importBaselineToStint(
        baselinePickerStintId,
        baseline,
        sessionName,
        stintName
      );
      setBaselinePickerStintId(null);
    },
    [baselinePickerStintId, importBaselineToStint]
  );

  // --- Weather override handler ---
  const handleWeatherOverride = useCallback(
    (field: "ambient" | "asphalt", value: number) => {
      if (field === "ambient") {
        addUserWeatherOverride({
          timestamp: new Date().toISOString(),
          ambientOverride: value,
        });
      } else {
        addUserWeatherOverride({
          timestamp: new Date().toISOString(),
          asphaltOverride: value,
        });
      }
    },
    [addUserWeatherOverride]
  );

  // --- Compute recommendation for a stint using its OWN pitstop data ---
  const computeStintRecommendation = useCallback(
    (stintId: string): RecommendationOutput | null => {
      if (!session) return null;
      const stint = session.stints?.find((s) => s.id === stintId);
      if (!stint || !stint.pitstops || stint.pitstops.length === 0) return null;
      const latestPitstop = stint.pitstops[stint.pitstops.length - 1];

      const input: RecommendationInput = {
        currentSession: session,
        currentStintId: stint.id,
        currentPitstopId: latestPitstop.id,
        nextConditions: {
          ambientTemp: stint.baseline?.ambientMeasured ?? 20,
          asphaltTemp: stint.baseline?.asphaltMeasured ?? 30,
          startTireTemps: stint.baseline?.startTireTemps,
        },
        targetMode: stint.baseline?.targetMode ?? "single",
        targets: stint.baseline?.targets ?? {},
        priorSessions: [],
        settings,
      };

      try {
        return computeRecommendation(input);
      } catch {
        return null;
      }
    },
    [session, settings]
  );

  /**
   * Compute recommendation for a NEW stint using the PREVIOUS stint as reference
   * but the CURRENT stint's baseline for nextConditions & targets.
   *
   * This is the key function: it answers "what cold pressures should I use for
   * stint N, given what happened in stint N-1 and the conditions/targets I've
   * entered for stint N?"
   */
  const computeRecForNextStint = useCallback(
    (prevStint: Stint, currentStint: Stint): RecommendationOutput | null => {
      if (!session) return null;
      if (!prevStint.pitstops || prevStint.pitstops.length === 0) return null;
      const latestPitstop = prevStint.pitstops[prevStint.pitstops.length - 1];

      // Use the current (new) stint's baseline for conditions & targets
      const curBaseline = currentStint.baseline;
      const input: RecommendationInput = {
        currentSession: session,
        currentStintId: prevStint.id,
        currentPitstopId: latestPitstop.id,
        nextConditions: {
          ambientTemp: curBaseline?.ambientMeasured ?? prevStint.baseline?.ambientMeasured ?? 20,
          asphaltTemp: curBaseline?.asphaltMeasured ?? prevStint.baseline?.asphaltMeasured ?? 30,
          startTireTemps: curBaseline?.startTireTemps,
        },
        targetMode: curBaseline?.targetMode ?? prevStint.baseline?.targetMode ?? "single",
        targets: curBaseline?.targets ?? prevStint.baseline?.targets ?? {},
        priorSessions: [],
        settings,
      };

      try {
        return computeRecommendation(input);
      } catch {
        return null;
      }
    },
    [session, settings]
  );

  // --- Add stint with recommended cold pressures ---
  const handleAddStint = useCallback(() => {
    if (!session || !session.stints || session.stints.length === 0) {
      addStint("Stint 1");
      return;
    }

    const stintNumber = session.stints.length + 1;
    const lastStint = session.stints[session.stints.length - 1];
    // Compute initial recommendation using prev stint's conditions as default
    // (user will tweak in the new stint's StintStartFlow, which triggers live recompute)
    const recommendation = computeStintRecommendation(lastStint.id);

    if (recommendation) {
      addStint(`Stint ${stintNumber}`, {
        coldPressures: recommendation.recommendedColdPressures,
        ambientMeasured: lastStint.baseline?.ambientMeasured,
        asphaltMeasured: lastStint.baseline?.asphaltMeasured,
      });
    } else {
      addStint(`Stint ${stintNumber}`);
    }
  }, [session, addStint, computeStintRecommendation]);

  /**
   * When user edits baseline on a non-first stint, auto-recompute cold pressures
   * from prev stint pitstop data + new conditions/targets.
   */
  const handleBaselineUpdateWithRecompute = useCallback(
    (stintId: string, stintIdx: number, updates: Partial<StintBaseline>) => {
      // Always write the update
      updateStintBaseline(stintId, updates);

      // If this is stint 2+ and user changed conditions/targets, recompute cold
      if (!session || stintIdx === 0) return;
      const relevantKeys: (keyof StintBaseline)[] = [
        "ambientMeasured",
        "asphaltMeasured",
        "startTireTemps",
        "targetMode",
        "targets",
      ];
      const changedRelevant = relevantKeys.some((k) => k in updates);
      if (!changedRelevant) return;

      const prevStint = session.stints[stintIdx - 1];
      const currentStint = session.stints.find((s) => s.id === stintId);
      if (!prevStint || !currentStint) return;

      // Merge the pending updates into a temporary view of the current baseline
      const mergedBaseline = { ...currentStint.baseline, ...updates };
      const tempStint = { ...currentStint, baseline: mergedBaseline };

      const rec = computeRecForNextStint(prevStint, tempStint);
      if (rec) {
        // Apply both the user's edits and the recomputed cold pressures together
        updateStintBaseline(stintId, {
          coldPressures: rec.recommendedColdPressures,
        });
      }
    },
    [session, updateStintBaseline, computeRecForNextStint]
  );

  // --- Toggle stint collapse ---
  const toggleStintCollapse = useCallback((stintId: string) => {
    setCollapsedStints((prev) => {
      const next = new Set(prev);
      if (next.has(stintId)) {
        next.delete(stintId);
      } else {
        next.add(stintId);
      }
      return next;
    });
  }, []);

  // ===== RENDER =========================================================

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <h1 className="text-2xl font-bold text-gray-200">Pressure Planner</h1>
        <p className="text-gray-400 text-center max-w-md">
          Start a new session to begin logging pitstop data and calculating tire
          pressures.
        </p>
        <Button size="lg" onClick={() => setShowNewSessionModal(true)}>
          + New Session
        </Button>

        <NewSessionModal
          open={showNewSessionModal}
          onClose={() => setShowNewSessionModal(false)}
          onSubmit={handleCreateSession}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Pressure Planner</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowNewSessionModal(true)}
          >
            New Session
          </Button>
          <Button variant="secondary" size="sm" onClick={closeSession}>
            Close Session
          </Button>
        </div>
      </div>

      {/* ── Session metadata ── */}
      <SessionHeader session={session} onUpdate={updateSession} />

      {/* ── Stints ── */}
      <div className="space-y-8">
        {session.stints?.map((stint, stintIdx) => {
          const isCollapsed = collapsedStints.has(stint.id);
          const isLastStint = stintIdx === (session.stints?.length ?? 0) - 1;
          const recommendation = computeStintRecommendation(stint.id);

          // Compute live recommendation for this stint from the PREVIOUS stint's
          // pitstop data + THIS stint's conditions/targets.
          let nextStintRec: RecommendationOutput | null = null;
          if (stintIdx > 0) {
            const prevStint = session.stints![stintIdx - 1];
            nextStintRec = computeRecForNextStint(prevStint, stint);
          }

          return (
            <div
              key={stint.id}
              className="rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden"
            >
              {/* ── Stint header ── */}
              <button
                type="button"
                className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                onClick={() => toggleStintCollapse(stint.id)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-gray-500 transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    {"\u25B6"}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-200">
                    {stint.name || `Stint ${stintIdx + 1}`}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {stint.pitstops?.length ?? 0} pitstop
                    {(stint.pitstops?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  {stint.importedBaseline && (
                    <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                      Imported
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportBaseline(stint)}
                  >
                    Export
                  </Button>
                </div>
              </button>

              {/* ── Stint body (collapsible) ── */}
              {!isCollapsed && (
                <div className="p-4 pt-0 space-y-4">
                  {/* ── Baseline / StintStartFlow ── */}
                  <StintStartFlow
                    stint={stint}
                    pressureUnit={settings.unitsPressure}
                    temperatureUnit={settings.unitsTemperature}
                    isImported={!!stint.importedBaseline}
                    recommendedColdPressures={
                      nextStintRec?.recommendedColdPressures
                    }
                    onBaselineUpdate={(updates) =>
                      handleBaselineUpdateWithRecompute(stint.id, stintIdx, updates)
                    }
                    onImportBaseline={(file) =>
                      handleImportBaseline(stint.id, file)
                    }
                    onPickFromHistory={() =>
                      setBaselinePickerStintId(stint.id)
                    }
                    onWeatherOverride={handleWeatherOverride}
                  />

                  {/* ── Pitstops ── */}
                  <div className="space-y-4 pl-4 border-l-2 border-slate-700">
                    {stint.pitstops?.map((pitstop) => {
                      const isLatest =
                        isLastStint &&
                        pitstop.id ===
                          stint.pitstops[stint.pitstops.length - 1]
                            .id;

                      return (
                        <PitstopCard
                          key={pitstop.id}
                          pitstop={pitstop}
                          onUpdate={(updates) =>
                            updatePitstop(stint.id, pitstop.id, updates)
                          }
                          onHotPressureChange={(corner, val) =>
                            updateHotPressure(
                              stint.id,
                              pitstop.id,
                              corner,
                              val
                            )
                          }
                          onBledPressureChange={(corner, val) =>
                            updateBledPressure(
                              stint.id,
                              pitstop.id,
                              corner,
                              val
                            )
                          }
                          onResetBledCorner={(corner) =>
                            resetBledCorner(stint.id, pitstop.id, corner)
                          }
                          onRemove={() =>
                            removePitstop(stint.id, pitstop.id)
                          }
                          isLatest={isLatest}
                          pressureUnit={settings.unitsPressure}
                          temperatureUnit={settings.unitsTemperature}
                        />
                      );
                    })}
                  </div>

                  {/* ── Add pitstop ── */}
                  <div className="flex ml-4 mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addPitstop(stint.id)}
                    >
                      + Add Pitstop to {stint.name || `Stint ${stintIdx + 1}`}
                    </Button>
                  </div>

                  {/* ── Recommendation for this stint ── */}
                  {stint.pitstops?.length > 0 && (
                    <RecommendationPanel
                      recommendation={recommendation}
                      pressureUnit={settings.unitsPressure}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Stint + bottom actions ── */}
      <div className="flex justify-center gap-4 pt-4 border-t border-slate-700">
        <Button variant="primary" onClick={handleAddStint}>
          + Add Stint
        </Button>
      </div>

      {/* ── Modals ── */}
      <NewSessionModal
        open={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        onSubmit={handleCreateSession}
      />

      <BaselinePickerModal
        open={baselinePickerStintId !== null}
        onClose={() => setBaselinePickerStintId(null)}
        onSelect={handlePickBaseline}
        pressureUnit={settings.unitsPressure}
      />
    </div>
  );
}
