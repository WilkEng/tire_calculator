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
import type { RecommendationOutput, Stint } from "@/lib/domain/models";
import { fetchForecast, estimateAsphaltTemp } from "@/lib/weather/openMeteo";
import { downloadJSON } from "@/lib/io/importExport";

export default function PlannerPage() {
  const {
    session,
    settings,
    createNewSession,
    addStint,
    addPitstop,
    updatePitstop,
    updateHotPressure,
    updateBledPressure,
    resetBledCorner,
    removePitstop,
    updateSession,
    updateStintBaseline,
  } = useSessionContext();

  const [fetchingStintId, setFetchingStintId] = useState<string | null>(null);

  const handleFetchWeather = useCallback((stintId: string) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setFetchingStintId(stintId);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const data = await fetchForecast(latitude, longitude);
          if (data && data.length > 0) {
            const current = data[0];
            const estAsphalt = estimateAsphaltTemp(
              current.ambient,
              current.shortwaveRadiation,
              current.windSpeed,
              current.cloudCover
            );
            updateStintBaseline(stintId, {
              ambientMeasured: current.ambient,
              asphaltMeasured: Number(estAsphalt.toFixed(1)),
            });
          } else {
            alert("No weather data found.");
          }
        } catch (e) {
          alert("Failed to fetch weather: " + String(e));
        } finally {
          setFetchingStintId(null);
        }
      },
      (error) => {
        alert("Geolocation error: " + error.message);
        setFetchingStintId(null);
      }
    );
  }, [updateStintBaseline]);

  const handleNewSession = useCallback(() => {
    createNewSession("New Session", "");
  }, [createNewSession]);

  const handleExportBaseline = useCallback((stint: Stint) => {
    const exportData = {
      version: 1,
      type: "stint-baseline",
      name: stint.name,
      baseline: stint.baseline
    };
    const json = JSON.stringify(exportData, null, 2);
    downloadJSON(json, `baseline-${stint.name || "export"}.json`);
  }, []);

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

      <SessionHeader session={session} onUpdate={updateSession} />

      <div className="space-y-8">
        {session.stints?.map((stint) => (
          <div key={stint.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-200">{stint.name || `Stint`}</h2>
              <Button variant="secondary" size="sm" onClick={() => handleExportBaseline(stint)}>
                Export Baseline
              </Button>
            </div>
            
            <div className="flex flex-wrap items-end gap-4 bg-gray-800/50 p-4 rounded border border-gray-700">
              <NumericInput
                label="Ambient Temp"
                unit={settings.unitsTemperature}
                value={stint.baseline.ambientMeasured}
                onChange={(val) => updateStintBaseline(stint.id, { ambientMeasured: val })}
              />
              <NumericInput
                label="Asphalt Temp"
                unit={settings.unitsTemperature}
                value={stint.baseline.asphaltMeasured}
                onChange={(val) => updateStintBaseline(stint.id, { asphaltMeasured: val })}
              />
              <Button
                variant="secondary"
                onClick={() => handleFetchWeather(stint.id)}
                disabled={fetchingStintId === stint.id}
              >
                {fetchingStintId === stint.id ? "Fetching..." : "Fetch Weather"}
              </Button>
            </div>

            <div className="space-y-4 pl-4 border-l-2 border-slate-700">
              {stint.pitstops?.map((pitstop) => {
                const isLatest = stint.id === session.stints[session.stints.length - 1].id &&
                                 pitstop.id === stint.pitstops[stint.pitstops.length - 1].id;
                                 
                return (
                  <PitstopCard
                    key={pitstop.id}
                    pitstop={pitstop}
                    onUpdate={(updates) => updatePitstop(stint.id, pitstop.id, updates)}       
                    onHotPressureChange={(corner, val) =>
                      updateHotPressure(stint.id, pitstop.id, corner, val)
                    }
                    onBledPressureChange={(corner, val) =>
                      updateBledPressure(stint.id, pitstop.id, corner, val)
                    }
                    onResetBledCorner={(corner) =>
                      resetBledCorner(stint.id, pitstop.id, corner)
                    }
                    onRemove={() => removePitstop(stint.id, pitstop.id)}
                    isLatest={isLatest}
                    pressureUnit={settings.unitsPressure}
                    temperatureUnit={settings.unitsTemperature}
                  />
                );
              })}
            </div>
            
            <div className="flex ml-4 mt-2">
              <Button variant="secondary" size="sm" onClick={() => addPitstop(stint.id)}>
                + Add Pitstop to {stint.name || `Stint`}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-4 pt-4 border-t border-slate-700">
        <Button variant="primary" onClick={() => addStint("New Stint")}>
          + Add Stint
        </Button>
      </div>
    </div>
  );
}
