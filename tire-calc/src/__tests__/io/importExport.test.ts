import { describe, it, expect } from "vitest";
import {
  exportSession,
  exportFullBackup,
  importSession,
  importFullBackup,
  exportSessionCSV,
  toJSON,
} from "@/lib/io/importExport";
import { makeSession, TEST_SETTINGS } from "../fixtures/testData";
import { makeReferencePitstop } from "../fixtures/testData";

describe("import/export round-trip", () => {
  it("exports and re-imports a single session", () => {
    const session = makeSession({
      pitstops: [makeReferencePitstop()],
    });

    const exported = exportSession(session);
    const json = toJSON(exported);
    const result = importSession(json);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.session).toBeDefined();
    expect(result.session!.id).toBe(session.id);
    expect(result.session!.name).toBe(session.name);
    expect(result.session!.pitstops).toHaveLength(1);
  });

  it("exports and re-imports a full backup", () => {
    const session1 = makeSession({ id: "s1", name: "Session 1" });
    const session2 = makeSession({ id: "s2", name: "Session 2" });

    const exported = exportFullBackup([session1, session2], TEST_SETTINGS);
    const json = toJSON(exported);
    const result = importFullBackup(json);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sessions).toHaveLength(2);
    expect(result.settings).toBeDefined();
  });

  it("rejects invalid JSON", () => {
    const result = importSession("not valid json{{{");
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Invalid JSON");
  });

  it("rejects wrong type", () => {
    const result = importSession(JSON.stringify({ type: "wrong-type" }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Expected type "tire-calc-session"');
  });

  it("rejects future schema version", () => {
    const data = {
      type: "tire-calc-session",
      schemaVersion: 999,
      session: makeSession(),
    };
    const result = importSession(JSON.stringify(data));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("newer than app version");
  });

  it("accepts older schema with migration warning", () => {
    // Simulate schema version 0 (older than current 1)
    const session = makeSession();
    const data = {
      type: "tire-calc-session",
      schemaVersion: 0,
      appVersion: "0.0.1",
      exportedAt: new Date().toISOString(),
      session,
    };
    const result = importSession(JSON.stringify(data));
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("older");
  });

  it("validates session structure", () => {
    const data = {
      type: "tire-calc-session",
      schemaVersion: 1,
      session: { notASession: true }, // missing id, name, trackName, pitstops
    };
    const result = importSession(JSON.stringify(data));
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("CSV export", () => {
  it("generates valid CSV with headers and data rows", () => {
    const session = makeSession({
      pitstops: [makeReferencePitstop()],
    });
    const csv = exportSessionCSV(session);
    const lines = csv.split("\n");

    // Header + 1 data row
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Pitstop");
    expect(lines[0]).toContain("Cold FL");
    expect(lines[0]).toContain("Hot FL");
    expect(lines[1]).toContain("1.70"); // cold FL value
    expect(lines[1]).toContain("1.87"); // hot FL value
  });
});
