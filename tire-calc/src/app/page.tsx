"use client";

import { useSessionContext } from "@/context/SessionContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useMemo } from "react";
import { computeRecommendation, type RecommendationInput } from "@/lib/engine";
import type { RecommendationOutput } from "@/lib/domain/models";

export default function DashboardPage() {
  const { session, settings, createNewSession } = useSessionContext();

  const recommendation: RecommendationOutput | null = useMemo(() => {
    if (!session || !session.stints || session.stints.length < 1) return null;
    const latestStint = session.stints[session.stints.length - 1];
    if (!latestStint.pitstops || latestStint.pitstops.length === 0) return null;
    const latestPitstop = latestStint.pitstops[latestStint.pitstops.length - 1];

    const input: RecommendationInput = {
      currentSession: session,
      currentStintId: latestStint.id,
      currentPitstopId: latestPitstop.id,
      nextConditions: {
        ambientTemp: latestStint.baseline?.ambientMeasured ?? 20,
        asphaltTemp: latestStint.baseline?.asphaltMeasured ?? 30,
        startTireTemps: latestStint.baseline?.startTireTemps,
      },
      targetMode: latestStint.baseline?.targetMode ?? "single",
      targets: latestStint.baseline?.targets ?? {},
      priorSessions: [],
      settings,
    };

    try {
      return computeRecommendation(input);
    } catch {
      return null;
    }
  }, [session, settings]);

  const latestStint = session?.stints?.[session.stints.length - 1];
  const latestPitstop = latestStint?.pitstops?.[latestStint.pitstops.length - 1];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>

      {!session ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <p className="text-gray-400 text-center max-w-md">
            No active session. Create one from the Planner or load from History.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => createNewSession("New Session", "")}>
              + New Session
            </Button>
            <Link href="/history">
              <Button variant="secondary">Load from History</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* -- Next Cold Recommendation Summary -- */}
          <Card title="Next Cold Recommendation" className="md:col-span-2 xl:col-span-1">
            {recommendation ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {(["FL", "FR", "RL", "RR"] as const).map((c) => (
                    <div key={c} className="text-center">
                      <div className="text-xs text-gray-400">{c}</div>
                      <div className="text-xl font-bold text-blue-400 tabular-nums">
                        {recommendation.recommendedColdPressures[c].toFixed(3)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {settings.unitsPressure}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {recommendation.rationaleText}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Add pitstop data in the Planner to see a recommendation.
              </p>
            )}
          </Card>

          {/* -- Current / Forecast Ambient -- */}
          <Card title="Ambient & Asphalt">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Ambient</div>
                <div className="text-2xl font-bold text-gray-200 tabular-nums">
                  {latestStint?.baseline?.ambientMeasured?.toFixed(1) ?? "�"}
                  <span className="text-sm text-gray-500 ml-1">
                    �{settings.unitsTemperature}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Asphalt</div>
                <div className="text-2xl font-bold text-gray-200 tabular-nums">
                  {latestStint?.baseline?.asphaltMeasured?.toFixed(1) ?? "�"}
                  <span className="text-sm text-gray-500 ml-1">
                    �{settings.unitsTemperature}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* -- Session Status -- */}
          <Card title="Session Status">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Pitstops</span>
                <span className="text-gray-200 font-medium">
                  {session.stints?.reduce((acc, s) => acc + s.pitstops.length, 0) || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Track</span>
                <span className="text-gray-200 font-medium">
                  {session.trackName || "�"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date</span>
                <span className="text-gray-200 font-medium">
                  {session.date ? new Date(session.date).toLocaleDateString() : "�"}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end">
              <Link href="/planner">
                <Button variant="secondary" size="sm">
                  Go to Planner ?
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
