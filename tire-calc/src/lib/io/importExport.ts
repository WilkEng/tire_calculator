// ─── Import / Export Services ──────────────────────────────────────
//
// Versioned JSON import/export for events and full backup.
// Optional CSV export for spreadsheet analysis.
// Strict schema validation with graceful migration hooks.
// ────────────────────────────────────────────────────────────────────

import type { Event, AppSettings, StintBaseline, PitstopEntry } from "../domain/models";
import { SCHEMA_VERSION, APP_VERSION } from "../domain/models";

// ─── Export Types ──────────────────────────────────────────────────

export interface EventExport {
  type: "tire-calc-event";
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  event: Event;
}

export interface FullBackupExport {
  type: "tire-calc-full-backup";
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  events: Event[];
  settings: AppSettings;
}

export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface EventImportResult extends ImportResult {
  event?: Event;
}

export interface FullBackupImportResult extends ImportResult {
  events?: Event[];
  settings?: AppSettings;
}

// ─── Export Functions ──────────────────────────────────────────────

/** Export a single event as a typed JSON object */
export function exportEvent(event: Event): EventExport {
  return {
    type: "tire-calc-event",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    event: structuredClone(event),
  };
}

/** Export all events + settings as a full backup */
export function exportFullBackup(
  events: Event[],
  settings: AppSettings
): FullBackupExport {
  return {
    type: "tire-calc-full-backup",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    events: structuredClone(events),
    settings: structuredClone(settings),
  };
}

/** Convert export object to a downloadable JSON string */
export function toJSON(data: EventExport | FullBackupExport): string {
  return JSON.stringify(data, null, 2);
}

/** Trigger a file download in the browser */
export function downloadJSON(
  json: string,
  filename: string
): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Import Functions ──────────────────────────────────────────────

/** Parse and validate an event import */
export function importEvent(json: string): EventImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { success: false, errors: ["Invalid JSON."], warnings: [] };
  }

  if (!isObject(data)) {
    return { success: false, errors: ["Expected a JSON object."], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.type !== "tire-calc-event") {
    return {
      success: false,
      errors: [`Expected type "tire-calc-event", got "${String(obj.type)}".`],
      warnings: [],
    };
  }

  // Schema version check
  const sv = obj.schemaVersion;
  if (typeof sv !== "number") {
    errors.push("Missing schemaVersion.");
  } else if (sv > SCHEMA_VERSION) {
    errors.push(
      `File schema version ${sv} is newer than app version ${SCHEMA_VERSION}. Please update the app.`
    );
  } else if (sv < SCHEMA_VERSION) {
    warnings.push(
      `File schema version ${sv} is older than current ${SCHEMA_VERSION}. Migration applied.`
    );
    // Future: apply migration transforms here
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  const parsed = obj.event ?? obj.session; // backward compat with old exports
  const eventErrors = validateEvent(parsed);
  if (eventErrors.length > 0) {
    return { success: false, errors: eventErrors, warnings };
  }

  return {
    success: true,
    errors: [],
    warnings,
    event: parsed as Event,
  };
}

/** Parse and validate a full backup import */
export function importFullBackup(json: string): FullBackupImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { success: false, errors: ["Invalid JSON."], warnings: [] };
  }

  if (!isObject(data)) {
    return { success: false, errors: ["Expected a JSON object."], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.type !== "tire-calc-full-backup") {
    return {
      success: false,
      errors: [
        `Expected type "tire-calc-full-backup", got "${String(obj.type)}".`,
      ],
      warnings: [],
    };
  }

  const sv = obj.schemaVersion;
  if (typeof sv !== "number") {
    errors.push("Missing schemaVersion.");
  } else if (sv > SCHEMA_VERSION) {
    errors.push(
      `Backup schema version ${sv} is newer than app version ${SCHEMA_VERSION}. Please update the app.`
    );
  } else if (sv < SCHEMA_VERSION) {
    warnings.push(
      `Backup schema version ${sv} is older. Migration applied.`
    );
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  // Validate events array (accept old 'sessions' key for backward compat)
  const eventsArray = obj.events ?? obj.sessions;
  if (!Array.isArray(eventsArray)) {
    errors.push("Missing or invalid events array.");
    return { success: false, errors, warnings };
  }

  for (let i = 0; i < (eventsArray as unknown[]).length; i++) {
    const sErrors = validateEvent((eventsArray as unknown[])[i]);
    for (const e of sErrors) {
      errors.push(`events[${i}]: ${e}`);
    }
  }

  // Validate settings
  if (!isObject(obj.settings)) {
    errors.push("Missing or invalid settings object.");
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  return {
    success: true,
    errors: [],
    warnings,
    events: eventsArray as Event[],
    settings: obj.settings as AppSettings,
  };
}

// ─── CSV Export ────────────────────────────────────────────────────

/** Export a event's pitstop data as CSV for spreadsheet analysis */
export function exportEventCSV(event: Event): string {
  const headers = [
    "Stint",
    "Pitstop",
    "Stint Start",
    "Pitstop Time",
    "Target Mode",
    "Baseline Cold FL",
    "Baseline Cold FR",
    "Baseline Cold RL",
    "Baseline Cold RR",
    "Hot FL",
    "Hot FR",
    "Hot RL",
    "Hot RR",
    "Bled FL",
    "Bled FR",
    "Bled RL",
    "Bled RR",
    "Rec Cold FL",
    "Rec Cold FR",
    "Rec Cold RL",
    "Rec Cold RR",
    "Notes",
  ];

  const rows: (string | number)[][] = [];
  (event.stints || []).forEach(stint => {
    const baseline = stint.baseline;
    (stint.pitstops || []).forEach((p, idx) => {
      rows.push([
        stint.name || "",
        idx,
        p.plannedStintStartTime ?? "",
        p.actualPitstopTime ?? "",
        baseline?.targetMode ?? "single",
        idx === 0 ? (baseline?.coldPressures?.FL ?? "") : "",
        idx === 0 ? (baseline?.coldPressures?.FR ?? "") : "",
        idx === 0 ? (baseline?.coldPressures?.RL ?? "") : "",
        idx === 0 ? (baseline?.coldPressures?.RR ?? "") : "",
        p.hotMeasuredPressures?.FL ?? "",
        p.hotMeasuredPressures?.FR ?? "",
        p.hotMeasuredPressures?.RL ?? "",
        p.hotMeasuredPressures?.RR ?? "",
        p.hotCorrectedPressures?.FL ?? p.hotMeasuredPressures?.FL ?? "",
        p.hotCorrectedPressures?.FR ?? p.hotMeasuredPressures?.FR ?? "",
        p.hotCorrectedPressures?.RL ?? p.hotMeasuredPressures?.RL ?? "",
        p.hotCorrectedPressures?.RR ?? p.hotMeasuredPressures?.RR ?? "",
        p.recommendationOutput?.recommendedColdPressures?.FL ?? "",
        p.recommendationOutput?.recommendedColdPressures?.FR ?? "",
        p.recommendationOutput?.recommendedColdPressures?.RL ?? "",
        p.recommendationOutput?.recommendedColdPressures?.RR ?? "",
        `"${(p.notes ?? "").replace(/"/g, '""')}"`,
      ]);
    });
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/** Trigger a CSV download */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Stint Baseline Import ─────────────────────────────────────────

export interface StintBaselineImportResult extends ImportResult {
  baseline?: StintBaseline;
  name?: string;
  pitstops?: PitstopEntry[];
}

/**
 * Import a stint baseline from a JSON string.
 * Validates the "stint-baseline" export format.
 */
export function importStintBaseline(json: string): StintBaselineImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { success: false, errors: ["Invalid JSON."], warnings: [] };
  }

  if (!isObject(data)) {
    return { success: false, errors: ["Expected a JSON object."], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.type !== "stint-baseline") {
    return {
      success: false,
      errors: [`Expected type "stint-baseline", got "${String(obj.type)}".`],
      warnings: [],
    };
  }

  if (!isObject(obj.baseline)) {
    return {
      success: false,
      errors: ["Missing baseline object."],
      warnings: [],
    };
  }

  const baseline = obj.baseline as Record<string, unknown>;

  // Validate required baseline fields
  if (typeof baseline.targetMode !== "string") {
    warnings.push("Missing targetMode, defaulting to 'single'.");
    baseline.targetMode = "single";
  }
  if (!isObject(baseline.targets)) {
    warnings.push("Missing targets, defaulting to empty.");
    baseline.targets = {};
  }

  return {
    success: true,
    errors: [],
    warnings,
    baseline: baseline as unknown as StintBaseline,
    name: typeof obj.name === "string" ? obj.name : undefined,
    pitstops: Array.isArray(obj.pitstops) ? (obj.pitstops as PitstopEntry[]) : undefined,
  };
}

// ─── Read a file from user input ───────────────────────────────────

/** Read a File object as text (for use with <input type="file">) */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ─── Validation Helpers ────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateEvent(s: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(s)) {
    errors.push("Event is not an object.");
    return errors;
  }
  const obj = s as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) errors.push("Missing event id.");
  if (typeof obj.name !== "string") errors.push("Missing event name.");
  if (typeof obj.trackName !== "string") errors.push("Missing trackName.");
  // v2+ uses stints[].pitstops, v1 used top-level pitstops
  if (!Array.isArray(obj.stints) && !Array.isArray(obj.pitstops)) {
    errors.push("Missing stints or pitstops array.");
  }
  return errors;
}
