// ─── IndexedDB Persistence Layer ───────────────────────────────────
//
// Local-first storage using the `idb` library.
// Two object stores: events and settings.
// Autosave, CRUD, and recovery after refresh.
// ────────────────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from "idb";
import type { Event } from "../domain/models";
import type { AppSettings } from "../domain/models";
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
        // Events store: keyed by event.id
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const eventStore = db.createObjectStore(SESSIONS_STORE, {
            keyPath: "id",
          });
          eventStore.createIndex("by-track", "trackName");
          eventStore.createIndex("by-date", "date");
          eventStore.createIndex("by-updated", "updatedAt");
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

// ─── Event CRUD ──────────────────────────────────────────────────

/** Save or update an event */
export async function saveEvent(event: Event): Promise<void> {
  const db = await getDB();
  const updated: Event = { ...event, updatedAt: nowISO() };
  await db.put(SESSIONS_STORE, updated);
}

/** Get a single event by id */
export async function getEvent(id: string): Promise<Event | undefined> {
  const db = await getDB();
  return db.get(SESSIONS_STORE, id);
}

/** Get all events, sorted by updatedAt (newest first) */
export async function getAllEvents(): Promise<Event[]> {
  const db = await getDB();
  const all = await db.getAll(SESSIONS_STORE);
  return all.sort((a: Event, b: Event) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/** Delete an event by id */
export async function deleteEvent(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(SESSIONS_STORE, id);
}

/** Get events for a specific track name */
export async function getEventsByTrack(
  trackName: string
): Promise<Event[]> {
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

/** Replace all events with a new set (used for full backup import) */
export async function replaceAllEvents(
  events: Event[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(SESSIONS_STORE, "readwrite");
  await tx.objectStore(SESSIONS_STORE).clear();
  for (const s of events) {
    await tx.objectStore(SESSIONS_STORE).put(s);
  }
  await tx.done;
}

/** Get total count of events */
export async function getEventCount(): Promise<number> {
  const db = await getDB();
  return db.count(SESSIONS_STORE);
}

export async function clearHistory(): Promise<void> {
  localStorage.removeItem("sessions");
}
