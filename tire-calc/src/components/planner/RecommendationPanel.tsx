"use client";

import type { RecommendationOutput } from "@/lib/domain/models";
import { Card } from "@/components/ui/Card";

interface RecommendationPanelProps {
  recommendation: RecommendationOutput | null;
  pressureUnit: string;
}

export function RecommendationPanel({
  recommendation,
  pressureUnit,
}: RecommendationPanelProps) {
  if (!recommendation) {
    return (
      <Card title="Next Cold Recommendation" className="border-blue-800">
        <p className="text-sm text-gray-400">
          Enter pitstop data above to get a recommendation.
        </p>
      </Card>
    );
  }

  const r = recommendation;
  const corners = ["FL", "FR", "RL", "RR"] as const;

  return (
    <Card title="Next Cold Recommendation" className="border-blue-800 bg-gray-900">
      {/* ── Recommended pressures ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {corners.map((c) => (
          <div key={c} className="text-center">
            <div className="text-xs text-gray-400 uppercase mb-1">{c}</div>
            <div className="text-2xl font-bold text-blue-400 tabular-nums">
              {r.recommendedColdPressures[c].toFixed(3)}
            </div>
            <div className="text-xs text-gray-500">{pressureUnit}</div>
          </div>
        ))}
      </div>

      {/* ── Predicted hot & deltas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {corners.map((c) => {
          const delta = r.deltasToTarget[c];
          const color =
            Math.abs(delta) < 0.005
              ? "text-green-400"
              : delta > 0
              ? "text-yellow-400"
              : "text-orange-400";
          return (
            <div key={c} className="text-center">
              <div className="text-xs text-gray-500">Predicted Hot</div>
              <div className="text-sm tabular-nums text-gray-300">
                {r.predictedHotPressures[c].toFixed(3)}
              </div>
              <div className={`text-xs tabular-nums ${color}`}>
                Δ {delta >= 0 ? "+" : ""}
                {delta.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Rationale ── */}
      <div className="bg-gray-800 rounded p-3 mb-3">
        <p className="text-sm text-gray-300 leading-relaxed">
          {r.rationaleText}
        </p>
      </div>

      {/* ── Metadata ── */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>
          Reference: {r.referenceSource.replace(/-/g, " ")}
        </span>
        <span>
          Confidence: {(r.confidenceScore * 100).toFixed(0)}%
        </span>
        <span>
          k_temp={r.coefficientsUsed.kTemp} · k_track=
          {r.coefficientsUsed.kTrack} · k_ambient=
          {r.coefficientsUsed.kAmbient}
        </span>
      </div>
    </Card>
  );
}
