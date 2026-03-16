/** Generate a stable, collision-resistant unique id (crypto.randomUUID where available, fallback). */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Current ISO-8601 timestamp string */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Round a number to `decimals` places */
export function round(value: number, decimals: number = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Unit Conversion ───────────────────────────────────────────────

/** Convert Celsius → Fahrenheit */
export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

/** Convert Fahrenheit → Celsius */
export function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

/** Convert bar → psi */
export function barToPsi(bar: number): number {
  return bar * 14.50377;
}

/** Convert psi → bar */
export function psiToBar(psi: number): number {
  return psi / 14.50377;
}

/** Convert bar → kPa */
export function barToKPa(bar: number): number {
  return bar * 100;
}

/** Convert kPa → bar */
export function kPaToBar(kPa: number): number {
  return kPa / 100;
}

/** Display a temperature value in the selected unit (internal storage is always °C) */
export function displayTemp(celsius: number, unit: string): number {
  return unit === "F" ? cToF(celsius) : celsius;
}

/** Convert a user-entered temperature back to °C for storage */
export function inputTemp(value: number, unit: string): number {
  return unit === "F" ? fToC(value) : value;
}

/** Display a pressure value in the selected unit (internal storage is always bar).
 *  Automatically rounds to the appropriate number of decimals for the unit. */
export function displayPressure(bar: number, unit: string): number {
  if (unit === "psi") return round(barToPsi(bar), 1);
  if (unit === "kPa") return round(barToKPa(bar), 0);
  return round(bar, 2);
}

/** Convert a user-entered pressure back to bar for storage */
export function inputPressure(value: number, unit: string): number {
  if (unit === "psi") return psiToBar(value);
  if (unit === "kPa") return kPaToBar(value);
  return value;
}

/** Display a temperature DELTA in the selected unit (Δ°F = Δ°C × 1.8) */
export function displayTempDelta(deltaC: number, unit: string): number {
  return unit === "F" ? deltaC * 1.8 : deltaC;
}

/** Convert a user-entered temperature DELTA back to °C for storage */
export function inputTempDelta(delta: number, unit: string): number {
  return unit === "F" ? delta / 1.8 : delta;
}

/** Display a kTemp value (bar/°C → user-pressure / user-temp) — compound-unit conversion.
 *  Automatically rounds to kTempDecimals precision. */
export function displayKTemp(barPerC: number, pUnit: string, tUnit: string): number {
  const raw = (pUnit === "psi" ? barToPsi(barPerC) : pUnit === "kPa" ? barToKPa(barPerC) : barPerC)
    / (tUnit === "F" ? 1.8 : 1);
  return round(raw, kTempDecimals(pUnit));
}

/** Convert a user-entered kTemp back to bar/°C for storage */
export function inputKTemp(value: number, pUnit: string, tUnit: string): number {
  return inputPressure(value, pUnit) * (tUnit === "F" ? 1.8 : 1);
}

/** Number of decimal places appropriate for a pressure unit */
export function pressureDecimals(unit: string): number {
  if (unit === "psi") return 1;
  if (unit === "kPa") return 0;
  return 2; // bar
}

/** Number of decimal places appropriate for kTemp (pressure/°) in each unit.
 *  Target resolution ≈ 0.001 bar/°C equivalent. */
export function kTempDecimals(pUnit: string): number {
  if (pUnit === "psi") return 3;
  if (pUnit === "kPa") return 2;
  return 4; // bar
}
