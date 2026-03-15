"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ChartDataPoint } from "@/lib/weather/openMeteo";

// ─── Types ─────────────────────────────────────────────────────────

interface TemperatureChartProps {
  data: ChartDataPoint[];
  temperatureUnit: string;
  /** Whether user has ambient overrides (to show user-corrected lines) */
  hasUserAmbient: boolean;
  /** Whether user has asphalt overrides */
  hasUserAsphalt: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────

function getCurrentHourLabel(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:00`;
}

// ─── Custom Tooltip ────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  temperatureUnit,
}: {
  active?: boolean;
  payload?: readonly { name: string; value: number; color: string }[];
  label?: string;
  temperatureUnit: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-gray-900/95 border border-gray-700 rounded px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: entry.color }}>
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}: {entry.value?.toFixed(1)}°{temperatureUnit}
        </p>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

export function TemperatureChart({
  data,
  temperatureUnit,
  hasUserAmbient,
  hasUserAsphalt,
}: TemperatureChartProps) {
  const currentHour = getCurrentHourLabel();

  // Determine Y-axis domain from data
  const [yMin, yMax] = useMemo(() => {
    if (data.length === 0) return [0, 40];
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      const vals = [
        d.apiAmbient,
        d.apiAsphalt,
        d.userAmbient,
        d.userAsphalt,
      ].filter((v): v is number => v != null);
      for (const v of vals) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    // Add padding
    return [Math.floor(min - 2), Math.ceil(max + 2)];
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No weather data available. Set a location to enable weather forecasts.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="hour"
          stroke="#6B7280"
          tick={{ fill: "#9CA3AF", fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, yMax]}
          stroke="#6B7280"
          tick={{ fill: "#9CA3AF", fontSize: 11 }}
          tickFormatter={(v: number) => `${v}°`}
          width={45}
        />
        <Tooltip
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload as unknown as readonly { name: string; value: number; color: string }[]}
              label={props.label as string}
              temperatureUnit={temperatureUnit}
            />
          )}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="line"
        />

        {/* "Now" reference line */}
        <ReferenceLine
          x={currentHour}
          stroke="#6366F1"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          label={{
            value: "Now",
            position: "top",
            fill: "#818CF8",
            fontSize: 10,
          }}
        />

        {/* API Ambient — solid blue */}
        <Line
          type="monotone"
          dataKey="apiAmbient"
          name="Ambient (API)"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />

        {/* API Asphalt — solid orange */}
        <Line
          type="monotone"
          dataKey="apiAsphalt"
          name="Asphalt Est. (API)"
          stroke="#F97316"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />

        {/* User-corrected Ambient — dashed blue (only if overrides exist) */}
        {hasUserAmbient && (
          <Line
            type="monotone"
            dataKey="userAmbient"
            name="Ambient (User)"
            stroke="#60A5FA"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        )}

        {/* User-corrected Asphalt — dashed orange (only if overrides exist) */}
        {hasUserAsphalt && (
          <Line
            type="monotone"
            dataKey="userAsphalt"
            name="Asphalt (User)"
            stroke="#FB923C"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 3 }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
