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
  Event,
  Stint,
  AppSettings,
  PitstopEntry,
  StintBaseline,
  Corner,
  UserWeatherOverride,
} from "@/lib/domain/models";
import { DEFAULT_APP_SETTINGS } from "@/lib/domain/models";
import {
  createEvent,
  createStint,
  createPitstopEntry,
  createUserWeatherOverride,
} from "@/lib/domain/factories";
import { saveEvent, loadSettings, saveSettings } from "@/lib/persistence/db";
import { nowISO } from "@/lib/utils/helpers";
import { expandTargets } from "@/lib/engine/pressureEngine";

interface EventContextValue {
  /** Current active event */
  event: Event | null;
  /** App settings */
  settings: AppSettings;

  /** Set the entire event (e.g. after loading from DB) */
  setEvent: (event: Event) => void;
  /** Create a new event with full metadata */
  createNewEvent: (params: {
    name: string;
    trackName: string;
    date?: string;
    vehicle?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    compoundPreset?: string;
    notes?: string;
  }) => Event;
  /** Close the active event */
  closeEvent: () => void;

  /** Create a new stint */
  addStint: (name: string, baselineOverrides?: Partial<StintBaseline>) => void;
  /** Update stint baseline */
  updateStintBaseline: (stintId: string, updates: Partial<StintBaseline>) => void;
  /** Update stint core fields (e.g. name) */
  updateStint: (stintId: string, updates: Partial<Stint>) => void;
  /** Import a baseline (and optionally pitstops) into a stint */
  importBaselineToStint: (
    stintId: string,
    baseline: StintBaseline,
    sourceEventName?: string,
    sourceStintName?: string,
    pitstops?: PitstopEntry[]
  ) => void;

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

  /** Remove a stint by id (cannot remove the first stint) */
  removeStint: (stintId: string) => void;

  /** Update event-level fields */
  updateEvent: (updates: Partial<Event>) => void;

  /** Add a user weather override (records user-measured ambient/asphalt with timestamp) */
  addUserWeatherOverride: (override: Omit<UserWeatherOverride, "id">) => void;

  /** Update settings */
  updateSettings: (updates: Partial<AppSettings>) => void;

  /** Trigger a manual save */
  save: () => Promise<void>;
}

const EventContext = createContext<EventContextValue | null>(null);

export function useEventContext(): EventContextValue {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEventContext must be used within EventProvider");
  return ctx;
}

export function EventProvider({ children }: { children: ReactNode }) {
  const [event, setEventState] = useState<Event | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  // Load settings on mount
  useEffect(() => {
    loadSettings().then(setSettingsState).catch(console.error);
  }, []);

  // Autosave whenever event changes
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => {
      saveEvent(event).catch(console.error);
    }, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [event]);

  const setEvent = useCallback((e: Event) => {
    setEventState(e);
  }, []);

  const createNewEvent = useCallback(
    (params: {
      name: string;
      trackName: string;
      date?: string;
      vehicle?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      compoundPreset?: string;
      notes?: string;
    }): Event => {
      const e = createEvent({
        name: params.name,
        trackName: params.trackName,
        date: params.date ?? new Date().toISOString().slice(0, 10),
        vehicle: params.vehicle ?? "",
        location: params.location ?? "",
        latitude: params.latitude,
        longitude: params.longitude,
        compoundPreset: params.compoundPreset ?? "",
        notes: params.notes ?? "",
      });
      // Add first Stint automatically
      const firstStint = createStint("Stint 1", settings.defaultTargetMode, {});
      e.stints = [firstStint];
      
      setEventState(e);
      return e;
    },
    [settings.defaultTargetMode]
  );

  const closeEvent = useCallback(() => {
    setEventState(null);
  }, []);

  const addStint = useCallback((name: string, baselineOverrides?: Partial<StintBaseline>) => {
    setEventState((prev) => {
      if (!prev) return prev;
      const lastStint = prev.stints[prev.stints.length - 1];
      const prevCompound = lastStint?.baseline.compound ?? settings.defaultCompound;
      const newStint = createStint(
        name, 
        lastStint?.baseline.targetMode ?? settings.defaultTargetMode,
        lastStint?.baseline.targets ?? {},
        prevCompound
      );
      // Apply baseline overrides (e.g. recommended cold pressures, weather conditions)
      if (baselineOverrides) {
        newStint.baseline = { ...newStint.baseline, ...baselineOverrides };
      }
      return {
        ...prev,
        stints: [...prev.stints, newStint],
        updatedAt: nowISO(),
      };
    });
  }, [settings.defaultTargetMode, settings.defaultCompound]);

  const updateStintBaseline = useCallback(
    (stintId: string, updates: Partial<StintBaseline>) => {
      setEventState((prev) => {
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
      setEventState((prev) => {
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
    setEventState((prev) => {
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
      setEventState((prev) => {
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
   * Default bled: if hot > target → target; if hot ≤ target → hot.
   */
  const updateHotPressure = useCallback(
    (stintId: string, pitstopId: string, corner: Corner, value: number | undefined) => {
      setEventState((prev) => {
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
              // Default: if hot > target → cap bled at target; otherwise keep hot
              let defaultBled = value;
              if (value != null) {
                const targets = expandTargets(stint.baseline.targetMode, stint.baseline.targets);
                const target = targets[corner];
                if (target != null && target > 0 && value > target) {
                  defaultBled = target;
                }
              }
              newBled = { ...p.hotCorrectedPressures, [corner]: defaultBled };
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
      setEventState((prev) => {
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
      setEventState((prev) => {
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
    setEventState((prev) => {
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

  /** Remove a stint by id. Cannot remove the first stint. */
  const removeStint = useCallback((stintId: string) => {
    setEventState((prev) => {
      if (!prev) return prev;
      // Don't allow removing the first stint
      if (prev.stints.length <= 1) return prev;
      if (prev.stints[0].id === stintId) return prev;
      const stints = prev.stints.filter((s) => s.id !== stintId);
      return { ...prev, stints, updatedAt: nowISO() };
    });
  }, []);

  /** Import a baseline (and optionally pitstops) into a stint — marks as imported. */
  const importBaselineToStint = useCallback(
    (
      stintId: string,
      baseline: StintBaseline,
      sourceEventName?: string,
      sourceStintName?: string,
      pitstops?: PitstopEntry[]
    ) => {
      setEventState((prev) => {
        if (!prev) return prev;
        // Strip weather conditions from imported baseline so they don't
        // override the current event's ambient/asphalt predictions.
        const importedBaseline = { ...baseline };
        delete importedBaseline.ambientMeasured;
        delete importedBaseline.asphaltMeasured;
        const stints = prev.stints.map((s) =>
          s.id === stintId
            ? {
                ...s,
                baseline: { ...importedBaseline },
                pitstops: pitstops ?? s.pitstops,
                importedBaseline: {
                  sourceEventName: sourceEventName,
                  sourceStintName,
                  importedAt: nowISO(),
                },
              }
            : s
        );
        return { ...prev, stints, updatedAt: nowISO() };
      });
    },
    []
  );

  /** Record a user weather override on the event. */
  const addUserWeatherOverride = useCallback(
    (override: Omit<UserWeatherOverride, "id">) => {
      setEventState((prev) => {
        if (!prev) return prev;
        const entry = createUserWeatherOverride(override);
        return {
          ...prev,
          userWeatherOverrides: [...(prev.userWeatherOverrides ?? []), entry],
          updatedAt: nowISO(),
        };
      });
    },
    []
  );

  const updateEvent = useCallback((updates: Partial<Event>) => {
    setEventState((prev) => {
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
    if (event) await saveEvent(event);
  }, [event]);

  return (
    <EventContext.Provider
      value={{
        event,
        settings,
        setEvent,
        createNewEvent,
        closeEvent,
        addStint,
        updateStintBaseline,
        updateStint,
        importBaselineToStint,
        addPitstop,
        updatePitstop,
        updateHotPressure,
        updateBledPressure,
        resetBledCorner,
        removePitstop,
        removeStint,
        updateEvent,
        addUserWeatherOverride,
        updateSettings,
        save,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}
