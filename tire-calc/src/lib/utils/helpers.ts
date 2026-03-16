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

/** Display a pressure value in the selected unit (internal storage is always bar) */
export function displayPressure(bar: number, unit: string): number {
  if (unit === "psi") return barToPsi(bar);
  if (unit === "kPa") return barToKPa(bar);
  return bar;
}

/** Convert a user-entered pressure back to bar for storage */
export function inputPressure(value: number, unit: string): number {
  if (unit === "psi") return psiToBar(value);
  if (unit === "kPa") return kPaToBar(value);
  return value;
}

/** Number of decimal places appropriate for a pressure unit */
export function pressureDecimals(unit: string): number {
  if (unit === "psi") return 1;
  if (unit === "kPa") return 0;
  return 2; // bar
}
