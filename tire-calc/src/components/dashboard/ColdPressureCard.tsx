"use client";

import type { RecommendationOutput, Corner } from "@/lib/domain/models";

// ─── Types ─────────────────────────────────────────────────────────

interface ColdPressureCardProps {
  recommendation: RecommendationOutput | null;
  pressureUnit: string;
  /** Description of conditions used, e.g. "Based on Stint 1 → API forecast" */
  conditionsLabel?: string;
}

const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];

// ─── Component ─────────────────────────────────────────────────────

export function ColdPressureCard({
  recommendation,
  pressureUnit,
  conditionsLabel,
}: ColdPressureCardProps) {
  if (!recommendation) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Next Cold Pressures
        </h3>
        <p className="text-sm text-gray-500">
          Complete a stint with pitstop data to see recommended cold pressures for your next run.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Next Cold Pressures
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Confidence: {(recommendation.confidenceScore * 100).toFixed(0)}%
          </span>
          <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${recommendation.confidenceScore * 100}%`,
                backgroundColor:
                  recommendation.confidenceScore > 0.6
                    ? "#22C55E"
                    : recommendation.confidenceScore > 0.3
                    ? "#EAB308"
                    : "#EF4444",
              }}
            />
          </div>
        </div>
      </div>

      {/* 4-corner pressures */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {CORNERS.map((c) => {
          const cold = recommendation.recommendedColdPressures[c];
          const delta = recommendation.deltasToTarget[c];

          return (
            <div key={c} className="text-center">
              <div className="text-xs text-gray-400 mb-1">{c}</div>
              <div className="text-2xl font-bold text-blue-400 tabular-nums leading-tight">
                {cold.toFixed(3)}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {pressureUnit}
              </div>
              {/* Delta indicator */}
              <div
                className={`text-xs mt-1 tabular-nums ${
                  Math.abs(delta) < 0.005
                    ? "text-green-400"
                    : delta > 0
                    ? "text-yellow-400"
                    : "text-orange-400"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rationale */}
      <p className="text-xs text-gray-400 leading-relaxed mb-2">
        {recommendation.rationaleText}
      </p>

      {/* Conditions label */}
      {conditionsLabel && (
        <p className="text-[10px] text-gray-500 mt-2">
          {conditionsLabel}
        </p>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-700/50 text-[10px] text-gray-500">
        <span>
          Ref: {recommendation.referenceSource.replace(/-/g, " ")}
        </span>
        <span>
          kT={recommendation.coefficientsUsed.kTemp} kTr=
          {recommendation.coefficientsUsed.kTrack} kA=
          {recommendation.coefficientsUsed.kAmbient}
        </span>
      </div>
    </div>
  );
}
