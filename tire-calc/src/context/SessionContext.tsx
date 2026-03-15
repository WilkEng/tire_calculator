"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Session,
  AppSettings,
  PitstopEntry,
  SessionStartBaseline,
  Corner,
} from "@/lib/domain/models";
import { DEFAULT_APP_SETTINGS } from "@/lib/domain/models";
import {
  createSession,
  createSessionStartBaseline,
  createPitstopEntry,
} from "@/lib/domain/factories";
import { saveSession, loadSettings, saveSettings } from "@/lib/persistence/db";
import { nowISO } from "@/lib/utils/helpers";

interface SessionContextValue {
  /** Current active session */
  session: Session | null;
  /** App settings */
  settings: AppSettings;

  /** Set the entire session (e.g. after loading from DB) */
  setSession: (session: Session) => void;
  /** Create a new blank session */
  createNewSession: (name: string, trackName: string) => Session;

  /** Update session start baseline */
  updateBaseline: (updates: Partial<SessionStartBaseline>) => void;

  /** Add a new pitstop to the current session */
  addPitstop: () => void;
  /** Update a specific pitstop by index */
  updatePitstop: (index: number, updates: Partial<PitstopEntry>) => void;
  /**
   * Update hot measured pressures with bled-defaults-to-hot logic.
   * Auto-copies hot to bled for corners not manually locked.
   */
  updateHotPressure: (
    pitstopIndex: number,
    corner: Corner,
    value: number | undefined
  ) => void;
  /**
   * Update a bled/corrected pressure and lock it from auto-overwrite.
   */
  updateBledPressure: (
    pitstopIndex: number,
    corner: Corner,
    value: number | undefined
  ) => void;
  /**
   * Reset a bled corner back to auto-follow-hot mode.
   */
  resetBledCorner: (pitstopIndex: number, corner: Corner) => void;
  /** Remove a pitstop by index */
  removePitstop: (index: number) => void;

  /** Update session-level fields */
  updateSession: (updates: Partial<Session>) => void;

  /** Update settings */
  updateSettings: (updates: Partial<AppSettings>) => void;

  /** Trigger a manual save */
  save: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then(setSettingsState).catch(console.error);
  }, []);

  // Autosave whenever session changes
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      saveSession(session).catch(console.error);
    }, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [session]);

  const setSession = useCallback((s: Session) => {
    setSessionState(s);
  }, []);

  const createNewSession = useCallback(
    (name: string, trackName: string): Session => {
      const s = createSession({
        name,
        trackName,
        baseline: createSessionStartBaseline(),
      });
      // Add first pitstop automatically
      const firstPitstop = createPitstopEntry(
        1,
        settings.defaultTargetMode,
        {}
      );
      s.pitstops = [firstPitstop];
      setSessionState(s);
      return s;
    },
    [settings.defaultTargetMode]
  );

  const updateBaseline = useCallback(
    (updates: Partial<SessionStartBaseline>) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          baseline: { ...prev.baseline, ...updates },
          updatedAt: nowISO(),
        };
      });
    },
    []
  );

  const addPitstop = useCallback(() => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const nextIndex = prev.pitstops.length + 1;
      // Copy target mode and targets from the last pitstop if available
      const lastPitstop = prev.pitstops[prev.pitstops.length - 1];
      const newPitstop = createPitstopEntry(
        nextIndex,
        lastPitstop?.targetMode ?? settings.defaultTargetMode,
        lastPitstop?.targets ?? {}
      );
      return {
        ...prev,
        pitstops: [...prev.pitstops, newPitstop],
        updatedAt: nowISO(),
      };
    });
  }, [settings.defaultTargetMode]);

  const updatePitstop = useCallback(
    (index: number, updates: Partial<PitstopEntry>) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const pitstops = prev.pitstops.map((p) =>
          p.index === index ? { ...p, ...updates } : p
        );
        return { ...prev, pitstops, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Update a hot pressure corner and auto-copy to bled if not locked.
   */
  const updateHotPressure = useCallback(
    (pitstopIndex: number, corner: Corner, value: number | undefined) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const pitstops = prev.pitstops.map((p) => {
          if (p.index !== pitstopIndex) return p;
          const newHot = { ...p.hotMeasuredPressures, [corner]: value };
          // Auto-copy to bled if this corner is NOT locked
          const isLocked = p.bledLocked?.[corner] === true;
          let newBled = p.hotCorrectedPressures;
          if (!isLocked) {
            newBled = { ...p.hotCorrectedPressures, [corner]: value };
          }
          return {
            ...p,
            hotMeasuredPressures: newHot,
            hotCorrectedPressures: newBled,
          };
        });
        return { ...prev, pitstops, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Update a bled/corrected corner and lock it from auto-overwrite.
   */
  const updateBledPressure = useCallback(
    (pitstopIndex: number, corner: Corner, value: number | undefined) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const pitstops = prev.pitstops.map((p) => {
          if (p.index !== pitstopIndex) return p;
          return {
            ...p,
            hotCorrectedPressures: {
              ...p.hotCorrectedPressures,
              [corner]: value,
            },
            bledLocked: { ...p.bledLocked, [corner]: true },
          };
        });
        return { ...prev, pitstops, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Reset a bled corner so it auto-follows hot pressure again.
   */
  const resetBledCorner = useCallback(
    (pitstopIndex: number, corner: Corner) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const pitstops = prev.pitstops.map((p) => {
          if (p.index !== pitstopIndex) return p;
          const newLocked = { ...p.bledLocked };
          delete newLocked[corner];
          // Reset bled to current hot value
          const hotVal = p.hotMeasuredPressures?.[corner];
          return {
            ...p,
            hotCorrectedPressures: {
              ...p.hotCorrectedPressures,
              [corner]: hotVal,
            },
            bledLocked: newLocked,
          };
        });
        return { ...prev, pitstops, updatedAt: nowISO() };
      });
    },
    []
  );

  const removePitstop = useCallback((index: number) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const pitstops = prev.pitstops
        .filter((p) => p.index !== index)
        .map((p, i) => ({ ...p, index: i + 1 })); // re-index
      return { ...prev, pitstops, updatedAt: nowISO() };
    });
  }, []);

  const updateSession = useCallback((updates: Partial<Session>) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates, updatedAt: nowISO() };
    });
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => {
      const next = { ...settings, ...updates };
      setSettingsState(next);
      saveSettings(next).catch(console.error);
    },
    [settings]
  );

  const save = useCallback(async () => {
    if (session) await saveSession(session);
  }, [session]);

  return (
    <SessionContext.Provider
      value={{
        session,
        settings,
        setSession,
        createNewSession,
        updateBaseline,
        addPitstop,
        updatePitstop,
        updateHotPressure,
        updateBledPressure,
        resetBledCorner,
        removePitstop,
        updateSession,
        updateSettings,
        save,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
