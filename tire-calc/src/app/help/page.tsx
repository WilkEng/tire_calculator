"use client";

import { useEventContext } from "@/context/EventContext";
import { Card } from "@/components/ui/Card";
import { AdBanner } from "@/components/shared/AdBanner";

export default function HelpPage() {
  const { settings } = useEventContext();
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100">Help &amp; User Manual</h1>

      <p className="text-sm text-gray-400">
        Tire Calc is a local-first race engineering app for calculating cold
        tire pressures so your hot pit pressures land on target. All data stays
        in your browser — no account or cloud required.
      </p>

      {/* ── Quick Start ── */}
      <Card title="Quick Start">
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>
            Open the <strong className="text-gray-100">Planner</strong> and
            create a new event (name, track, date).
          </li>
          <li>
            Add your first <strong className="text-gray-100">Stint</strong>.
            Each stint contains one or more pitstops.
          </li>
          <li>
            In <strong className="text-gray-100">Pitstop 1</strong>, enter your
            target hot pressure, cold start pressures, ambient &amp; asphalt
            temperatures.
          </li>
          <li>
            After the car returns, enter hot measured &amp; corrected/bled
            pressures.
          </li>
          <li>
            Add the next pitstop — the app will recommend a cold pressure for
            the upcoming stint, adjusting for condition changes.
          </li>
          <li>
            Repeat for every stint. The recommendation updates live based on
            your data.
          </li>
        </ol>
      </Card>

      {/* ── Dashboard ── */}
      <Card title="Dashboard">
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            The dashboard is your at-a-glance overview. It shows:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">Quick Calculator</strong> — a
              standalone single-shot cold pressure calculator. Enter a known
              reference stint&apos;s data plus the next conditions and get an
              instant recommendation. Great for non-session calculations.
            </li>
            <li>
              <strong className="text-gray-100">Weather Forecast</strong> — if
              your event has coordinates (or geolocation is allowed), the
              dashboard fetches a 48-hour hourly forecast from Open-Meteo
              showing ambient temperature, cloud cover, and wind.
            </li>
            <li>
              <strong className="text-gray-100">Session Status</strong> —
              active event name, track, date, compound, pitstop count, and a
              link to the planner.
            </li>
            <li>
              <strong className="text-gray-100">Last Pitstop Summary</strong> —
              the most recent hot measured / corrected pressures, deltas to
              target, and the recommendation that was generated.
            </li>
          </ul>
        </div>
      </Card>

      {/* ── Pressure Planner ── */}
      <Card title="Pressure Planner">
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            This is the main working page where you manage your event, stints,
            and pitstops.
          </p>

          <h4 className="text-gray-100 font-semibold mt-2">Events &amp; Stints</h4>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              Create a new event with the <em>+ New Event</em> button. Fill in
              name, track, date, location, and compound.
            </li>
            <li>
              Each event can contain multiple <strong className="text-gray-100">stints</strong>.
              A stint groups pitstops that share a baseline.
            </li>
            <li>
              Use <em>Import Baseline</em> to pull reference data from a prior
              event for session-to-session carry-over.
            </li>
          </ul>

          <h4 className="text-gray-100 font-semibold mt-2">Pitstop Cards</h4>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">Target Mode</strong> — choose
              &quot;Single&quot; (one target for all corners), &quot;Front /
              Rear&quot;, or &quot;Per-Corner&quot;.
            </li>
            <li>
              <strong className="text-gray-100">Cold Start Pressures</strong> —
              the pressures you put the tires on at.
            </li>
            <li>
              <strong className="text-gray-100">Hot Measured Pressures</strong> —
              what you read when the car comes in.
            </li>
            <li>
              <strong className="text-gray-100">Hot Corrected / Bled</strong> —
              the actual target you bled or bumped to (may differ from target).
            </li>
            <li>
              <strong className="text-gray-100">Ambient &amp; Asphalt</strong> —
              track and air temperature at the time of the stint.
            </li>
            <li>
              <strong className="text-gray-100">Start Tire Temps</strong> —
              optional tire temperature before the stint. Defaults to the
              previous value or a global default from settings.
            </li>
          </ul>

          <h4 className="text-gray-100 font-semibold mt-2">Recommendations</h4>
          <p>
            Each pitstop (after the first) shows a recommendation panel with:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Recommended cold pressure per corner.</li>
            <li>Predicted hot pressure if you follow the recommendation.</li>
            <li>Delta to your target — green means within tolerance.</li>
            <li>
              A plain-language <strong className="text-gray-100">rationale</strong> explaining: which reference was
              used, what the feedback correction was, and how condition changes
              affected the number.
            </li>
          </ul>

          <h4 className="text-gray-100 font-semibold mt-2">Quick Calculator</h4>
          <p>
            Available on both the Dashboard and Planner. Enter reference cold,
            reference hot, target hot, plus condition temperatures, and the
            compound — get an instant cold pressure recommendation without
            needing to create an event.
          </p>
        </div>
      </Card>

      {/* ── Temperature Analysis ── */}
      <Card title="Temperature Analysis">
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            The Temperature page lets you visualize and compare pyrometer or
            probe readings. This data is <strong className="text-gray-100">for
            analysis only</strong> — it does not feed into the Level 1 pressure
            engine.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">Comparison Charts</strong> —
              select data sources (pitstop readings, imported pyro data) and
              overlay them on per-corner line charts showing inner, middle, and
              outer temperatures.
            </li>
            <li>
              <strong className="text-gray-100">Load from History</strong> —
              import temperature data from other saved events to compare across
              weekends.
            </li>
            <li>
              <strong className="text-gray-100">Warning Badges</strong> — the
              charts flag potential camber and pressure issues based on
              inner-vs-outer and center-vs-edge spread thresholds.
            </li>
          </ul>
        </div>
      </Card>

      {/* ── History & Data ── */}
      <Card title="History & Data Management">
        <div className="space-y-3 text-sm text-gray-300">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">Event List</strong> — browse
              all saved events. The active event is highlighted with a green
              badge.
            </li>
            <li>
              <strong className="text-gray-100">Open</strong> — switch to a
              different event.
            </li>
            <li>
              <strong className="text-gray-100">Clone</strong> — duplicate an
              event (e.g., to start a new weekend from last week&apos;s
              setup).
            </li>
            <li>
              <strong className="text-gray-100">Export JSON</strong> — download
              a single event as a versioned JSON file.
            </li>
            <li>
              <strong className="text-gray-100">Export CSV</strong> — download
              pitstop data as a CSV spreadsheet.
            </li>
            <li>
              <strong className="text-gray-100">Full Backup</strong> — export
              every event and your settings in one JSON file.
            </li>
            <li>
              <strong className="text-gray-100">Import</strong> — drag-and-drop
              or pick a JSON file. The app auto-detects whether it&apos;s a
              single event or a full backup.
            </li>
            <li>
              <strong className="text-gray-100">Preview</strong> — inspect an
              event&apos;s contents before opening it.
            </li>
            <li>
              <strong className="text-gray-100">Delete</strong> — remove events
              you no longer need (with confirmation).
            </li>
          </ul>
        </div>
      </Card>

      {/* ── Settings ── */}
      <Card title="Settings">
        <div className="space-y-3 text-sm text-gray-300">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">Units</strong> — choose bar or
              psi for pressure; °C or °F for temperature.
            </li>
            <li>
              <strong className="text-gray-100">Default Target Mode</strong> —
              Single, Front/Rear, or Per-Corner. Pitstops will pre-fill with
              this mode.
            </li>
            <li>
              <strong className="text-gray-100">Default Start Tire Temp</strong> —
              used when no prior data exists for a corner.
            </li>
            <li>
              <strong className="text-gray-100">Carry-Over</strong> —
              enable/disable session-to-session carry-over blending. When
              enabled, the engine gently biases recommendations using prior
              events at the same track.
            </li>
            <li>
              <strong className="text-gray-100">Classic Mode</strong> — locks
              the engine to the Wilkinson spreadsheet coefficients (k_temp =
              0.012, k_track = 1.75, k_ambient = 1.0).
            </li>
            <li>
              <strong className="text-gray-100">Advanced Coefficients</strong> —
              when classic mode is off, you can tune k_temp, k_track, and
              k_ambient.
            </li>
            <li>
              <strong className="text-gray-100">Compound Presets</strong> —
              built-in and custom compound definitions with temperature
              sensitivity coefficients.
            </li>
            <li>
              <strong className="text-gray-100">Camber Spread Threshold</strong> —
              the expected inner − outer temperature delta for your current
              camber. Deviations beyond ±6 °{settings.unitsTemperature} from this value
              trigger warnings on the temperature page.
            </li>
          </ul>
        </div>
      </Card>

      {/* ── How the Pressure Model Works ── */}
      <Card title="How the Pressure Model Works">
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            The Level 1 engine answers:
            <em className="text-gray-200">
              &ldquo;What cold pressure should I start with so the hot pit
              pressure lands on my target?&rdquo;
            </em>
          </p>

          <h4 className="text-gray-100 font-semibold mt-2">Formula</h4>
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed">
            <div>nextCold = referenceCold</div>
            <div className="pl-8">+ feedbackCorrection</div>
            <div className="pl-8">− conditionCorrection</div>
            <div className="pl-8">+ carryOverCorrection</div>
          </div>

          <h4 className="text-gray-100 font-semibold mt-2">Terms</h4>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-gray-100">referenceCold</strong> — cold
              pressure from the best matching prior pitstop.
            </li>
            <li>
              <strong className="text-gray-100">feedbackCorrection</strong> —
              (targetHot − measuredHot) from the reference stint. If the car
              came in high, this reduces the next cold pressure.
            </li>
            <li>
              <strong className="text-gray-100">conditionCorrection</strong> —
              adjustment for changing ambient, asphalt, and tire temps:
              <div className="bg-gray-800/50 rounded px-3 py-2 font-mono text-xs mt-1">
                effectiveTempDelta = (ΔAmbient × k_ambient) + (ΔAsphalt ×
                k_track) + (ΔTire × 1.0)
                <br />
                conditionCorrection = effectiveTempDelta × k_temp
              </div>
            </li>
            <li>
              <strong className="text-gray-100">carryOverCorrection</strong> —
              a small weighted bias from prior events at the same track
              (only active when carry-over is enabled and confidence is
              sufficient).
            </li>
          </ul>

          <h4 className="text-gray-100 font-semibold mt-2">Reference Selection</h4>
          <p>The engine picks the best reference in priority order:</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li>Same stint, nearest previous pitstop.</li>
            <li>Same event, nearest previous pitstop in another stint.</li>
            <li>Prior event at the same track with matching target mode.</li>
            <li>Prior event at the same track (any mode).</li>
            <li>Classic mode fallback (preset coefficients only).</li>
          </ol>
        </div>
      </Card>

      {/* ── Data & Privacy ── */}
      <Card title="Data & Privacy">
        <div className="space-y-3 text-sm text-gray-300">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              All data is stored <strong className="text-gray-100">locally in
              your browser</strong> using IndexedDB. Nothing is sent to any
              server.
            </li>
            <li>
              Weather forecasts are fetched from{" "}
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00d4aa] underline"
              >
                Open-Meteo
              </a>{" "}
              (free, open-source API). Only coordinates are sent — no personal
              data.
            </li>
            <li>
              Use <strong className="text-gray-100">Export / Import</strong> to
              back up your data. If you clear browser storage, your data is
              gone unless you have a backup.
            </li>
            <li>
              The app works offline after the first load (when installed as a
              PWA). No internet is needed except for weather forecast fetches.
            </li>
          </ul>
        </div>
      </Card>

      {/* ── Tips ── */}
      <Card title="Tips & Best Practices">
        <div className="space-y-3 text-sm text-gray-300">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              Always enter <strong className="text-gray-100">hot corrected /
              bled</strong> pressures — these represent your actual target after
              real-world adjustment and improve future recommendations.
            </li>
            <li>
              Use <strong className="text-gray-100">Front/Rear or Per-Corner</strong>{" "}
              target mode if your car has different pressure targets by axle.
            </li>
            <li>
              Clone last weekend&apos;s event before a new weekend — this
              preserves your baseline and speeds up setup.
            </li>
            <li>
              Export a JSON backup after every race day. It takes 2 seconds and
              can save hours of re-entry.
            </li>
            <li>
              If the recommendation seems off, check the <strong className="text-gray-100">rationale
              text</strong> — it explains exactly which reference and
              corrections were applied.
            </li>
            <li>
              Install the app to your home screen (via your browser&apos;s
              &quot;Add to Home Screen&quot; option) for a full-screen,
              app-like experience.
            </li>
          </ul>
        </div>
      </Card>

      {/* ── Keyboard Shortcuts / Interactions ── */}
      <Card title="Navigating the App">
        <div className="space-y-3 text-sm text-gray-300">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>
              Use the <strong className="text-gray-100">top navigation bar</strong> to
              switch between Dashboard, Planner, Temps, History, Settings, and
              this Help page.
            </li>
            <li>
              Pitstop cards are <strong className="text-gray-100">collapsible</strong> —
              tap the header to expand or collapse details.
            </li>
            <li>
              All numeric inputs accept decimal values and respond to keyboard
              arrow keys for fine adjustment.
            </li>
            <li>
              The app automatically saves your data as you type — there is no
              &quot;Save&quot; button needed.
            </li>
          </ul>
        </div>
      </Card>

      <AdBanner />
    </div>
  );
}
