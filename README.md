<p align="center">
  <img src="tire-calc/public/icon-512.png" alt="Tire Calc" width="120" />
</p>

<h1 align="center">Tire Calc</h1>

<p align="center">
  <strong>Open-source, local-first tire pressure calculator for race engineers</strong>
</p>

<p align="center">
  <a href="https://wilkeng.github.io/tire_calculator/">Live App</a>&ensp;·&ensp;
  <a href="https://github.com/WilkEng/tire_calculator/issues">Report a Bug</a>&ensp;·&ensp;
  <a href="https://github.com/WilkEng/tire_calculator/issues">Request a Feature</a>&ensp;·&ensp;
  <a href="https://wilkinson-engineering.de">Wilkinson Engineering</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/next.js-16.1-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-4-38bdf8?logo=tailwindcss" alt="Tailwind" />
</p>

---

## What is Tire Calc?

**Tire Calc** is a web-based race engineering tool that calculates the optimal cold tire pressure so your hot pit pressure lands on target — without needing bleed-up or bleed-down. Built for kart, GT, touring car, and formula teams of any level.

It replaces the spreadsheet-on-a-clipboard workflow with a proper app that runs entirely in your browser — no account, no cloud, no subscription.

### Key Features

| Feature | Description |
|---|---|
| **Pressure Planner** | Multi-stint, multi-pitstop pressure planning with live recommendations |
| **Smart Recommendations** | Reference-based engine that learns from your previous stints and adjusts for changing conditions |
| **Condition Correction** | Automatic adjustment for ambient temperature, asphalt temperature, and starting tire temperature changes |
| **Session Carry-Over** | Gently blends data from prior events at the same track to improve predictions |
| **Weather Integration** | 48-hour forecast from Open-Meteo with ambient, cloud cover, wind, and estimated asphalt temperature |
| **Quick Calculator** | Standalone one-shot cold pressure calculator — no event setup needed |
| **Temperature Analysis** | Pyrometer / probe data visualization with per-corner inner/middle/outer comparison charts |
| **Data Management** | Full JSON import/export, CSV export, event cloning, and backup/restore |
| **Installable PWA** | Add to your home screen for a full-screen, app-like experience that works offline |
| **100% Local** | All data stored in IndexedDB in your browser. Nothing leaves your device. |

---

## How It Works

The Level 1 pressure engine answers one question:

> *"What cold pressure should I start the next stint with so the measured hot pit pressure lands on my target?"*

### The Formula

```
nextCold = referenceCold + feedbackCorrection − conditionCorrection + carryOverCorrection
```

| Term | Meaning |
|---|---|
| **referenceCold** | Cold pressure from the best-matching prior pitstop |
| **feedbackCorrection** | `targetHot − measuredHot` from the reference stint — corrects for over/under-pressure |
| **conditionCorrection** | Pressure adjustment for changing ambient, asphalt, and tire temperatures |
| **carryOverCorrection** | Small weighted bias from prior events at the same track (optional) |

### Condition Correction

```
effectiveTempDelta = (ΔAmbient × k_ambient) + (ΔAsphalt × k_track) + (ΔTire × 1.0)
conditionCorrection = effectiveTempDelta × k_temp
```

Default coefficients (Classic Wilkinson mode):
- `k_temp` = 0.012 bar/°C
- `k_track` = 1.75
- `k_ambient` = 1.0

Every recommendation includes a **plain-language rationale** explaining which reference was used, what the feedback correction was, and how conditions affected the result.

---

## Screenshots

<details>
<summary>Dashboard</summary>

The dashboard shows the active event status, weather forecast, quick calculator, and last pitstop summary at a glance.

</details>

<details>
<summary>Pressure Planner</summary>

The planner lets you manage stints and pitstops with live per-corner cold pressure recommendations, predicted hot pressures, and delta-to-target indicators.

</details>

<details>
<summary>Temperature Analysis</summary>

Compare pyrometer readings across pitstops and events with per-corner line charts, camber/pressure warning badges, and imported data overlays.

</details>

---

## Getting Started

### Use the Live App

The fastest way to use Tire Calc is the hosted version on GitHub Pages:

**→ [wilkeng.github.io/tire_calculator](https://wilkeng.github.io/tire_calculator/)**

No install needed. Works on any modern browser (desktop, tablet, phone). Add it to your home screen for a standalone app experience.

### Run Locally

```bash
# Clone the repository
git clone https://github.com/WilkEng/tire_calculator.git
cd tire_calculator/tire-calc

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
```

This generates a static export in `tire-calc/out/` ready for any static hosting provider.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, static export) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Charts | [Recharts 3](https://recharts.org/) |
| Persistence | IndexedDB via [idb](https://github.com/jakearchibald/idb) |
| Weather | [Open-Meteo](https://open-meteo.com/) (free, open-source API) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

### Project Structure

```
tire-calc/
├── public/               # Static assets, PWA manifest, service worker
├── src/
│   ├── app/              # Next.js pages (dashboard, planner, temperature, history, settings, help)
│   ├── components/       # React components (ui, planner, dashboard, temperature, history, layout, shared)
│   ├── context/          # React context (EventContext with autosave)
│   ├── hooks/            # Custom hooks (useSessionState, useWeatherForecast, useGeolocation)
│   └── lib/
│       ├── domain/       # TypeScript models, types, factory functions
│       ├── engine/       # Pure pressure calculation engine
│       ├── io/           # JSON/CSV import & export
│       ├── persistence/  # IndexedDB CRUD layer
│       ├── utils/        # Shared helpers (generateId, round, clamp)
│       └── weather/      # Open-Meteo API client & asphalt estimator
```

---

## Data & Privacy

- **All data stays in your browser.** Tire Calc uses IndexedDB for local storage. No data is sent to any server.
- **Weather requests** go to [Open-Meteo](https://open-meteo.com/). Only GPS coordinates are transmitted — no personal data.
- **Export early, export often.** If you clear your browser storage, your data is gone unless you have a JSON backup.
- **The app works offline** after the first load (when installed as a PWA). Internet is only needed for weather forecasts.

---

## Contributing

Contributions are welcome! Whether it's a bug fix, a feature idea, or an improvement to the calculation engine — we'd love to hear from you.

### Opening a Ticket

1. Go to the [Issues](https://github.com/WilkEng/tire_calculator/issues) tab.
2. Check if your issue or idea already exists.
3. Click **New Issue** and choose **Bug Report** or **Feature Request**.
4. Describe the problem or idea clearly. Include steps to reproduce for bugs.

### Submitting a Pull Request

1. **Fork** the repository.
2. Create a **feature branch** from `main` (`git checkout -b feature/my-improvement`).
3. Make your changes in the `tire-calc/` directory.
4. Run `npm run build` and `npx eslint src/` to verify zero errors.
5. **Commit** with a descriptive message.
6. Open a **Pull Request** against `main` with a summary of the changes.

> **Note:** By contributing, you agree that your contributions will be licensed under the same CC BY-NC-SA 4.0 license as the project. All improvements must be shared back under the same terms.

---

## License

This project is licensed under the [**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International**](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

**In plain language:**

| You can… | You must… | You cannot… |
|---|---|---|
| ✅ Use it for free | 📝 Credit **Wilkinson Engineering** | 🚫 Use it commercially |
| ✅ Modify and adapt it | 🔄 Share improvements under the same license | 🚫 Sublicense or close-source derivatives |
| ✅ Share it with others | 🔗 Link back to this repository | 🚫 Remove attribution |

See the full [LICENSE](LICENSE) file for details.

---

## Acknowledgements

Built by **[Wilkinson Engineering GmbH](https://wilkinson-engineering.de)** — precision alignment and race engineering tools.

- Pressure model based on the Wilkinson Engineering race-day spreadsheet methodology
- Weather data provided by [Open-Meteo](https://open-meteo.com/) (free, open-source)
- Built with [Next.js](https://nextjs.org/), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), and [Recharts](https://recharts.org/)

---

<p align="center">
  <sub>Made with 🏁 for the paddock</sub>
</p>
