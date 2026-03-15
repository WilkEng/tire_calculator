// ─── Import / Export Services ──────────────────────────────────────
//
// Versioned JSON import/export for sessions and full backup.
// Optional CSV export for spreadsheet analysis.
// Strict schema validation with graceful migration hooks.
// ────────────────────────────────────────────────────────────────────

import type { Session, AppSettings } from "../domain/models";
import { SCHEMA_VERSION, APP_VERSION } from "../domain/models";

// ─── Export Types ──────────────────────────────────────────────────

export interface SessionExport {
  type: "tire-calc-session";
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  session: Session;
}

export interface FullBackupExport {
  type: "tire-calc-full-backup";
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  sessions: Session[];
  settings: AppSettings;
}

export interface ImportResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface SessionImportResult extends ImportResult {
  session?: Session;
}

export interface FullBackupImportResult extends ImportResult {
  sessions?: Session[];
  settings?: AppSettings;
}

// ─── Export Functions ──────────────────────────────────────────────

/** Export a single session as a typed JSON object */
export function exportSession(session: Session): SessionExport {
  return {
    type: "tire-calc-session",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    session: structuredClone(session),
  };
}

/** Export all sessions + settings as a full backup */
export function exportFullBackup(
  sessions: Session[],
  settings: AppSettings
): FullBackupExport {
  return {
    type: "tire-calc-full-backup",
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: structuredClone(sessions),
    settings: structuredClone(settings),
  };
}

/** Convert export object to a downloadable JSON string */
export function toJSON(data: SessionExport | FullBackupExport): string {
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

/** Parse and validate a session import */
export function importSession(json: string): SessionImportResult {
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

  if (obj.type !== "tire-calc-session") {
    return {
      success: false,
      errors: [`Expected type "tire-calc-session", got "${String(obj.type)}".`],
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

  const session = obj.session;
  const sessionErrors = validateSession(session);
  if (sessionErrors.length > 0) {
    return { success: false, errors: sessionErrors, warnings };
  }

  return {
    success: true,
    errors: [],
    warnings,
    session: session as Session,
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

  // Validate sessions array
  if (!Array.isArray(obj.sessions)) {
    errors.push("Missing or invalid sessions array.");
    return { success: false, errors, warnings };
  }

  for (let i = 0; i < (obj.sessions as unknown[]).length; i++) {
    const sErrors = validateSession((obj.sessions as unknown[])[i]);
    for (const e of sErrors) {
      errors.push(`sessions[${i}]: ${e}`);
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
    sessions: obj.sessions as Session[],
    settings: obj.settings as AppSettings,
  };
}

// ─── CSV Export ────────────────────────────────────────────────────

/** Export a session's pitstop data as CSV for spreadsheet analysis */
export function exportSessionCSV(session: Session): string {
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
  (session.stints || []).forEach(stint => {
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

function validateSession(s: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(s)) {
    errors.push("Session is not an object.");
    return errors;
  }
  const obj = s as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) errors.push("Missing session id.");
  if (typeof obj.name !== "string") errors.push("Missing session name.");
  if (typeof obj.trackName !== "string") errors.push("Missing trackName.");
  if (!Array.isArray(obj.pitstops)) errors.push("Missing pitstops array.");
  return errors;
}
