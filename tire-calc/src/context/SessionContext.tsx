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
  Stint,
  AppSettings,
  PitstopEntry,
  StintBaseline,
  Corner,
} from "@/lib/domain/models";
import { DEFAULT_APP_SETTINGS } from "@/lib/domain/models";
import {
  createSession,
  createStint,
  createStintBaseline,
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

  /** Create a new stint */
  addStint: (name: string) => void;
  /** Update stint baseline */
  updateStintBaseline: (stintId: string, updates: Partial<StintBaseline>) => void;
  /** Update stint core fields (e.g. name) */
  updateStint: (stintId: string, updates: Partial<Stint>) => void;

  /** Add a new pitstop to a stint */
  addPitstop: (stintId: string) => void;
  /** Update a specific pitstop by id within a stint */
  updatePitstop: (stintId: string, pitstopId: string, updates: Partial<PitstopEntry>) => void;
  /**
   * Update hot measured pressures with bled-defaults-to-hot logic.
   * Auto-copies hot to bled for corners not manually locked.
   */
  updateHotPressure: (
    stintId: string,
    pitstopId: string,
    corner: Corner,
    value: number | undefined
  ) => void;
  /**
   * Update a bled/corrected pressure and lock it from auto-overwrite.
   */
  updateBledPressure: (
    stintId: string,
    pitstopId: string,
    corner: Corner,
    value: number | undefined
  ) => void;
  /**
   * Reset a bled corner back to auto-follow-hot mode.
   */
  resetBledCorner: (stintId: string, pitstopId: string, corner: Corner) => void;
  /** Remove a pitstop by id from a stint */
  removePitstop: (stintId: string, pitstopId: string) => void;

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
      });
      // Add first Stint automatically
      const firstStint = createStint("FP1", settings.defaultTargetMode, {});
      const firstPitstop = createPitstopEntry(1);
      firstStint.pitstops = [firstPitstop];
      s.stints = [firstStint];
      
      setSessionState(s);
      return s;
    },
    [settings.defaultTargetMode]
  );

  const addStint = useCallback((name: string) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const lastStint = prev.stints[prev.stints.length - 1];
      const newStint = createStint(
        name, 
        lastStint?.baseline.targetMode ?? settings.defaultTargetMode,
        lastStint?.baseline.targets ?? {}
      );
      return {
        ...prev,
        stints: [...prev.stints, newStint],
        updatedAt: nowISO(),
      };
    });
  }, [settings.defaultTargetMode]);

  const updateStintBaseline = useCallback(
    (stintId: string, updates: Partial<StintBaseline>) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map((s) =>
          s.id === stintId ? { ...s, baseline: { ...s.baseline, ...updates } } : s
        );
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  const updateStint = useCallback(
    (stintId: string, updates: Partial<Stint>) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map((s) =>
          s.id === stintId ? { ...s, ...updates } : s
        );
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  const addPitstop = useCallback((stintId: string) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const stints = prev.stints.map(stint => {
        if (stint.id !== stintId) return stint;
        const nextIndex = stint.pitstops.length + 1;
        const newPitstop = createPitstopEntry(nextIndex);
        return { ...stint, pitstops: [...stint.pitstops, newPitstop] };
      });
      return {
        ...prev,
        stints,
        updatedAt: nowISO(),
      };
    });
  }, []);

  const updatePitstop = useCallback(
    (stintId: string, pitstopId: string, updates: Partial<PitstopEntry>) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map(stint => {
          if (stint.id !== stintId) return stint;
          const pitstops = stint.pitstops.map(p =>
            p.id === pitstopId ? { ...p, ...updates } : p
          );
          return { ...stint, pitstops };
        });
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Update a hot pressure corner and auto-copy to bled if not locked.
   */
  const updateHotPressure = useCallback(
    (stintId: string, pitstopId: string, corner: Corner, value: number | undefined) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map(stint => {
          if (stint.id !== stintId) return stint;
          const pitstops = stint.pitstops.map((p) => {
            if (p.id !== pitstopId) return p;
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
          return { ...stint, pitstops };
        });
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Update a bled/corrected corner and lock it from auto-overwrite.
   */
  const updateBledPressure = useCallback(
    (stintId: string, pitstopId: string, corner: Corner, value: number | undefined) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map(stint => {
          if (stint.id !== stintId) return stint;
          const pitstops = stint.pitstops.map((p) => {
            if (p.id !== pitstopId) return p;
            return {
              ...p,
              hotCorrectedPressures: {
                ...p.hotCorrectedPressures,
                [corner]: value,
              },
              bledLocked: { ...p.bledLocked, [corner]: true },
            };
          });
          return { ...stint, pitstops };
        });
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  /**
   * Reset a bled corner so it auto-follows hot pressure again.
   */
  const resetBledCorner = useCallback(
    (stintId: string, pitstopId: string, corner: Corner) => {
      setSessionState((prev) => {
        if (!prev) return prev;
        const stints = prev.stints.map(stint => {
          if (stint.id !== stintId) return stint;
          const pitstops = stint.pitstops.map((p) => {
            if (p.id !== pitstopId) return p;
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
          return { ...stint, pitstops };
        });
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  const removePitstop = useCallback((stintId: string, pitstopId: string) => {
    setSessionState((prev) => {
      if (!prev) return prev;
      const stints = prev.stints.map(stint => {
        if (stint.id !== stintId) return stint;
        const pitstops = stint.pitstops
          .filter((p) => p.id !== pitstopId)
          .map((p, i) => ({ ...p, index: i + 1 })); // re-index
        return { ...stint, pitstops };
      });
      return { ...prev, stints, updatedAt: nowISO() };
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
        addStint,
        updateStintBaseline,
        updateStint,
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

