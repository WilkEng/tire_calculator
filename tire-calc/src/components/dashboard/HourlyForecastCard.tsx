"use client";

import { useRef, useEffect } from "react";
import type { HourlyCardData } from "@/lib/weather/openMeteo";

// ─── Types ─────────────────────────────────────────────────────────

interface HourlyForecastCardProps {
  cards: HourlyCardData[];
  temperatureUnit: string;
}

// ─── Weather Icons (inline SVG) ────────────────────────────────────

function WeatherIcon({ icon, size = 28 }: { icon: HourlyCardData["icon"]; size?: number }) {
  const s = size;
  switch (icon) {
    case "sunny":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="6" fill="#FBBF24" />
          {/* Rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 16 + Math.cos(rad) * 9;
            const y1 = 16 + Math.sin(rad) * 9;
            const x2 = 16 + Math.cos(rad) * 12;
            const y2 = 16 + Math.sin(rad) * 12;
            return (
              <line
                key={angle}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round"
              />
            );
          })}
        </svg>
      );

    case "partly-cloudy":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          {/* Small sun */}
          <circle cx="22" cy="10" r="4" fill="#FBBF24" />
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={22 + Math.cos(rad) * 6} y1={10 + Math.sin(rad) * 6}
                x2={22 + Math.cos(rad) * 7.5} y2={10 + Math.sin(rad) * 7.5}
                stroke="#FBBF24" strokeWidth="1" strokeLinecap="round"
              />
            );
          })}
          {/* Cloud */}
          <ellipse cx="14" cy="22" rx="10" ry="5" fill="#9CA3AF" />
          <ellipse cx="11" cy="19" rx="5" ry="4" fill="#D1D5DB" />
          <ellipse cx="17" cy="18" rx="6" ry="5" fill="#D1D5DB" />
        </svg>
      );

    case "cloudy":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <ellipse cx="16" cy="22" rx="11" ry="5" fill="#9CA3AF" />
          <ellipse cx="12" cy="18" rx="6" ry="5" fill="#D1D5DB" />
          <ellipse cx="19" cy="17" rx="7" ry="5.5" fill="#D1D5DB" />
        </svg>
      );

    case "rain":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          {/* Cloud */}
          <ellipse cx="16" cy="16" rx="10" ry="5" fill="#9CA3AF" />
          <ellipse cx="12" cy="13" rx="5.5" ry="4.5" fill="#D1D5DB" />
          <ellipse cx="18" cy="12" rx="6" ry="5" fill="#D1D5DB" />
          {/* Rain drops */}
          <line x1="10" y1="22" x2="8" y2="27" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="22" x2="14" y2="27" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="22" y1="22" x2="20" y2="27" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

// ─── Component ─────────────────────────────────────────────────────

export function HourlyForecastCard({ cards, temperatureUnit }: HourlyForecastCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the current hour on mount
  useEffect(() => {
    if (!scrollRef.current || cards.length === 0) return;
    const nowHour = new Date().getHours();
    const currentIdx = cards.findIndex(
      (c) => parseInt(c.hour.split(":")[0], 10) === nowHour
    );
    if (currentIdx >= 0) {
      const cardWidth = 72; // approximate width per card slot
      scrollRef.current.scrollLeft = Math.max(0, currentIdx * cardWidth - 36);
    }
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm py-6">
        No forecast data available.
      </div>
    );
  }

  const nowHour = new Date().getHours();

  return (
    <div
      ref={scrollRef}
      className="flex gap-0 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800/50 pb-1"
      style={{ scrollBehavior: "smooth" }}
    >
      {cards.map((card) => {
        const hour = parseInt(card.hour.split(":")[0], 10);
        const isCurrent = hour === nowHour;

        return (
          <div
            key={card.time}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-3 rounded-lg transition-colors w-[68px] ${
              isCurrent
                ? "bg-teal-900/30 border border-teal-700/50"
                : "hover:bg-gray-800/30"
            }`}
          >
            {/* Hour */}
            <span
              className={`text-xs font-medium mb-1 ${
                isCurrent ? "text-teal-400" : "text-gray-400"
              }`}
            >
              {isCurrent ? "Now" : card.hour}
            </span>

            {/* Weather icon */}
            <WeatherIcon icon={card.icon} size={26} />

            {/* Temperature */}
            <span
              className={`text-sm font-semibold mt-1 tabular-nums ${
                isCurrent ? "text-white" : "text-gray-200"
              }`}
            >
              {card.temp}°{temperatureUnit}
            </span>

            {/* Rain indicator */}
            {card.rainLikely && (
              <span className="text-[10px] text-teal-400 mt-0.5">
                {card.humidity}%
              </span>
            )}

            {/* Cloud cover small indicator */}
            {!card.rainLikely && card.cloudCover > 30 && (
              <span className="text-[10px] text-gray-500 mt-0.5">
                {card.cloudCover}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
