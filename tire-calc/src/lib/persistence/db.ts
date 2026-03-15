// ─── IndexedDB Persistence Layer ───────────────────────────────────
//
// Local-first storage using the `idb` library.
// Two object stores: sessions and settings.
// Autosave, CRUD, and recovery after refresh.
// ────────────────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from "idb";
import type { Session, AppSettings } from "../domain/models";
import { DEFAULT_APP_SETTINGS } from "../domain/models";
import { nowISO } from "../utils/helpers";

const DB_NAME = "tire-calc-db";
const DB_VERSION = 1;

// Store names
const SESSIONS_STORE = "sessions";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "app-settings";

// ─── DB Initialization ─────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Sessions store: keyed by session.id
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionStore = db.createObjectStore(SESSIONS_STORE, {
            keyPath: "id",
          });
          sessionStore.createIndex("by-track", "trackName");
          sessionStore.createIndex("by-date", "date");
          sessionStore.createIndex("by-updated", "updatedAt");
        }

        // Settings store: single key-value
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE);
        }
      },
    });
  }
  return dbPromise;
}

// ─── Session CRUD ──────────────────────────────────────────────────

/** Save or update a session */
export async function saveSession(session: Session): Promise<void> {
  const db = await getDB();
  const updated: Session = { ...session, updatedAt: nowISO() };
  await db.put(SESSIONS_STORE, updated);
}

/** Get a single session by id */
export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get(SESSIONS_STORE, id);
}

/** Get all sessions, sorted by updatedAt (newest first) */
export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAll(SESSIONS_STORE);
  return all.sort((a: Session, b: Session) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** Delete a session by id */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(SESSIONS_STORE, id);
}

/** Get sessions for a specific track name */
export async function getSessionsByTrack(
  trackName: string
): Promise<Session[]> {
  const db = await getDB();
  const index = db
    .transaction(SESSIONS_STORE)
    .objectStore(SESSIONS_STORE)
    .index("by-track");
  return index.getAll(trackName);
}

// ─── App Settings ──────────────────────────────────────────────────

/** Load settings (returns defaults if not yet saved) */
export async function loadSettings(): Promise<AppSettings> {
  const db = await getDB();
  const stored = await db.get(SETTINGS_STORE, SETTINGS_KEY);
  if (stored) return stored as AppSettings;
  // Initialize with defaults
  await db.put(SETTINGS_STORE, DEFAULT_APP_SETTINGS, SETTINGS_KEY);
  return { ...DEFAULT_APP_SETTINGS };
}

/** Save settings */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put(SETTINGS_STORE, settings, SETTINGS_KEY);
}

// ─── Bulk Operations (for import/export) ───────────────────────────

/** Replace all sessions with a new set (used for full backup import) */
export async function replaceAllSessions(
  sessions: Session[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  await tx.objectStore(SESSIONS_STORE).clear();
  for (const s of sessions) {
    await tx.objectStore(SESSIONS_STORE).put(s);
  }
  await tx.done;
}

/** Get total count of sessions */
export async function getSessionCount(): Promise<number> {
  const db = await getDB();
  return db.count(SESSIONS_STORE);
}

export async function clearHistory(): Promise<void> {
  localStorage.removeItem("sessions");
}
