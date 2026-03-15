# Tire Calc – Project TODO

## Development Order (per prompt spec)
1. Define domain schema
2. Implement pure calculation engine
3. Implement local persistence
4. Implement import/export
5. Implement pressure planner UI
6. Implement weather/asphalt layer
7. Implement dashboard/history pages
8. Implement temperature analysis page
9. Add tests, demo data, and documentation

---

## TODO Items

### 1. Project Scaffold
- **Status:** DONE
- **What:** Initialize Next.js (App Router) + TypeScript + Tailwind CSS project
- **Done:** Created Next.js 16 project at `tire-calc/` with TypeScript, Tailwind CSS, ESLint, App Router, src directory. Node v24.14, npm 11.9.
- **Remaining:** –

### 2. Folder Structure
- **Status:** DONE
- **What:** Create the full module-based folder layout per prompt spec
- **Done:** Created `src/lib/{domain,engine,weather,persistence,io,utils}`, `src/components/{ui,planner,dashboard,temperature,history,charts,layout}`, `src/app/{planner,temperature,history,settings}`, `src/hooks`, `src/context`, `src/__tests__/{engine,io,persistence,fixtures}`
- **Remaining:** –

### 3. Typed Domain Models
- **Status:** DONE
- **What:** Implement TypeScript interfaces/types for AppSettings, Session, PitstopEntry, Targets, RecommendationOutput, TemperatureRun, WeatherSnapshot
- **Done:** Full typed models in `src/lib/domain/models.ts` with all enums (PressureUnit, TemperatureUnit, TargetMode, Corner, WeatherSource, ReferenceSource), value objects (CornerValues, Targets, CornerTemperatureReading, etc.), entity interfaces (Session, PitstopEntry, TemperatureRun, WeatherSnapshot, AppSettings, RecommendationOutput), constants (SCHEMA_VERSION, APP_VERSION), and DEFAULT_APP_SETTINGS. Factory functions in `src/lib/domain/factories.ts`. Utility helpers in `src/lib/utils/helpers.ts` (generateId, nowISO, round, clamp). All files compile cleanly.
- **Remaining:** –

### 4. Level 1 Calculation Engine
- **Status:** DONE
- **What:** Pure functions for reference-based pressure recommendation, reference-stint selection, classic Wilkinson mode, condition correction, carry-over, confidence scoring
- **Done:** Full engine in `src/lib/engine/pressureEngine.ts` — `computeRecommendation()`, `selectReference()`, `computeFeedbackCorrection()`, `computeConditionCorrection()`, `computeEffectiveTempDelta()`, `computeCarryOverBias()`, `computeCarryOverConfidence()`, `expandTargets()`, `getEffectiveTargetPerCorner()`. Classic fallback mode, human-readable rationale text generation, per-corner computation for all target modes. Barrel export in `index.ts`. Clean compile.
- **Remaining:** –

### 5. Local Persistence (IndexedDB)
- **Status:** DONE
- **What:** IndexedDB persistence layer with autosave, session recovery, local-first startup
- **Done:** Full persistence in `src/lib/persistence/db.ts` using `idb` library. Two stores: `sessions` (keyed by id, indexed by track/date/updated) and `settings` (single key). CRUD: `saveSession`, `getSession`, `getAllSessions`, `deleteSession`, `getSessionsByTrack`. Settings: `loadSettings` (returns defaults if none saved), `saveSettings`. Bulk: `replaceAllSessions`, `getSessionCount`. All timestamps auto-updated. Clean compile.
- **Remaining:** –

### 6. Import / Export Services
- **Status:** DONE
- **What:** Versioned JSON import/export for sessions and full backup; optional CSV export; schema validation and migration hooks
- **Done:** Full I/O layer in `src/lib/io/importExport.ts`. Export: `exportSession`, `exportFullBackup`, `toJSON`, `downloadJSON`. Import: `importSession`, `importFullBackup` with strict validation (type check, schema version check, session structure validation), migration warnings, and graceful error messages. CSV: `exportSessionCSV`, `downloadCSV`. File reading: `readFileAsText`. All exports include schemaVersion + appVersion. Barrel export in `index.ts`. Clean compile.
- **Remaining:** –

### 7. Pressure Planner UI
- **Status:** DONE
- **What:** Main page — target mode selector, pitstop timeline, data entry, recommendation panel with rationale
- **Done:** Full planner UI implemented: `SessionContext` (React context with autosave, CRUD for sessions/pitstops, settings management). App shell with nav (`AppNav`, `AppShell`). Reusable UI components (`NumericInput`, `Card`, `Button`, `Select`). Planner components: `PitstopCard` (collapsible, all fields: target mode + targets, conditions, cold/hot/corrected pressures, start tire temps, notes), `RecommendationPanel` (per-corner recommended cold, predicted hot, deltas with color coding, rationale text, metadata), `SessionHeader` (name, track, date, location, compound, notes). Main page at `/planner` with session creation, pitstop timeline, live recommendation computation via engine. Clean compile.
- **Remaining:** –

### 8. Weather / Asphalt Layer
- **Status:** DONE
- **What:** Open-Meteo integration, geolocation/search, forecast + historical lookup, asphalt estimator with bias correction
- **Done:** Full weather service in `src/lib/weather/openMeteo.ts`. Forecast: `fetchForecast` (48h hourly from Open-Meteo), `fetchHistorical` (archive API, date range). Helpers: `findNearestForecast` (closest to target time), `forecastPointToSnapshot` (to domain model). Asphalt: `estimateAsphaltTemp` (empirical model from radiation/wind/cloud/ambient, configurable coefficients), `computeAsphaltWithBias` (bias-correction from measured values). Geolocation: `getUserLocation` (browser API), `searchLocation` (Open-Meteo geocoding). Clean compile.
- **Remaining:** –

### 9. Dashboard Page
- **Status:** DONE
- **What:** Summary cards for next recommendation, ambient/asphalt, last pitstop result, quick actions
- **Done:** Full dashboard at `/` (root page). Shows: next cold recommendation summary with per-corner values and rationale, current/forecast ambient & asphalt, session status (name, track, date, pitstop count, compound), last pitstop result with hot measured + corrected, quick action buttons (Go to Planner, Export, Import). Empty state with new session creation. Clean compile.
- **Remaining:** –

### 10. Data / History Page
- **Status:** DONE
- **What:** Session browser, open/clone/delete, import/export UI, CSV export
- **Done:** Full history page at `/history`. Lists all saved sessions from IndexedDB with active indicator. Per-session actions: Open, Clone, JSON export, CSV export, Delete (with confirm). Top-level actions: Import JSON (auto-detects session vs full backup), Export Full Backup. Status messages with auto-dismiss. Clean compile.
- **Remaining:** –

### 11. Temperature Analysis Page
- **Status:** DONE
- **What:** Pyrometer/probe logging, inner/middle/outer visualization, run comparison, averaging, clear separation from pressure engine
- **Done:** Full page at `/temperature`. Add/remove temperature runs. Per-run: setup tag, hot pressure group, notes. Per-corner: inner/middle/outer NumericInput. Group filter by tag/hot-pressure-group. Computed averages across selected runs per corner with avg display. Clear info banner: "Probe data is for analysis only, not used in Level 1 engine." Also built Settings page at `/settings` with: units, defaults, carry-over toggle, classic mode toggle, advanced coefficients (k_temp, k_track, k_ambient), app info. Clean compile.
- **Remaining:** –

### 12. Tests & Demo Data
- **Status:** NOT STARTED
- **What:** Unit tests for calc engine, import/export round-trip, fixture-based classic mode validation, demo dataset
- **Done:** –
- **Remaining:** All tests and seed data

### 13. README Documentation
- **Status:** NOT STARTED
- **What:** Setup, architecture, data model, calculation logic, limitations, next steps
- **Done:** –
- **Remaining:** Full documentation

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-14 | Created todo.md with full task breakdown from product_spec.md and promt.md |
| 2026-03-14 | Scaffolded Next.js 16 project (TS + Tailwind + ESLint + App Router) |
| 2026-03-14 | Created full modular folder structure (17 directories) |
| 2026-03-14 | Implemented all typed domain models, factories, and utility helpers — clean compile |
| 2026-03-14 | Built complete Level 1 pressure calculation engine with all pure functions — clean compile |
| 2026-03-14 | Implemented IndexedDB persistence layer (idb) with sessions + settings stores — clean compile |
| 2026-03-14 | Built import/export services (JSON session/backup, CSV, validation, migration hooks) — clean compile |
| 2026-03-14 | Built Pressure Planner UI: SessionContext, AppShell, nav, UI components, PitstopCard, RecommendationPanel, SessionHeader, /planner page — clean compile |
| 2026-03-14 | Implemented weather/asphalt layer (Open-Meteo forecast+archive, asphalt estimator, geolocation, location search) — clean compile |
| 2026-03-14 | Built Dashboard page (recommendation summary, ambient/asphalt, session status, last pitstop, quick actions) — clean compile |
| 2026-03-14 | Built Data/History page (session browser, open/clone/delete, JSON/CSV export, import with auto-detect) — clean compile |
| 2026-03-14 | Built Temperature Analysis page (pyrometer logging, I/M/O per corner, averaging, grouping) + Settings page — clean compile |
