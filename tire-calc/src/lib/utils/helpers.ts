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
