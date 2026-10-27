# Dashboard sample scenarios

Status: approved and implemented on 2026-10-27; user subsequently authorized commit and push to the development branch. Main merge/deployment are not authorized.
Date: 2026-10-27 IST.

## Intent and agreed requirements

Provide a dependable way for the teacher to see the dashboard's alert animations
and network behavior when the single physical sensor prototype cannot demonstrate
the complete system or ESP32 readings cannot be fetched.

- Keep everything in the existing website, using the main dashboard.
- Provide a simple tab/control to select preloaded sample scenarios.
- Demonstrate several alerts at one or multiple fictional locations.
- Selecting a scenario starts automatic playback. Restart is the only playback
  control. Pause, seeking, speed selection and manual stepping are deferred.
- No separate site or hosting project.

## Current implementation

The existing React dashboard renders an API snapshot containing summary counts,
effective sensor observations, nodes and incidents. The backend simulator persists
one selected hazard per demo node and emits further readings. Its endpoint accepts
normal, methane, H2S, overflow or cover. These controls require Flask.

The frontend already supports reactive manhole geometry, concurrent hazard
presentation, incident events, map markers, history and optional alert sounds.
`useMonitor` owns the current API polling. Existing hardware and simulator source
checks must remain intact.

## Approaches and selection

1. Extend backend-driven simulator presets: preserves real database ingestion, but
   still needs the API and does not provide an independent presentation fallback.
2. Browser-owned sample scenarios using existing dashboard components: works without
   sensor/API responses after the website has loaded, without a second site. This
   is the proposed approach, consistent with the discussed fallback requirement.

Automatic versus step-by-step playback was discussed separately. The user selected
automatic playback plus Restart only; complete playback controls are deferred.

## Proposed behavior

The same website offers Live and Demo scenarios views/modes. The exact control
placement is left to the builder within the existing Pulse design.

- Entering Demo scenarios starts the default scenario automatically.
- Choosing another scenario resets its timeline and starts it automatically.
- Restart resets the currently selected scenario and starts it from its beginning.
- Each scenario runs once and holds its final state with a visible Completed label.
  It does not loop automatically. This is a proposed implementation choice.
- Returning to Live cancels the demo timer and fetches current real data. An API
  failure is displayed honestly; sample readings never become live readings.
- A browser reload returns to the usual Live entry state; demo playback is not
  persisted or silently resumed. Demo entry remains available on initial API failure.

Proposed initial library, approximately 45-60 seconds each:

| Scenario | Sequence |
| --- | --- |
| Gas incident | Fresh normal network, rising methane at one location, threshold crossing/new alert, then normal measurements return while the incident remains open. |
| Campus incidents | Staggered overflow, H2S and cover alerts at three locations, with other locations remaining normal. |
| Combined hazards | Methane and overflow at one location; gas returns to normal while overflow remains; finally both readings return to normal while the incidents remain open. |

Each timeline begins with normal values for all channels on its participating
sample nodes. Use the existing fictional campus catalogue, with a clearly labelled
simulated network. No artificial real-world measurements or deployments are claimed.

The builder may choose exact event times and synthetic values, using the existing
demonstration threshold policy and readable pauses between events. Include a
brief current-stage caption. Automatically focus the cutaway on the newly affected
location at major stages so the teacher sees the animation without switching nodes;
the map and feed retain the full network view. This is a proposed choice.

## Data, isolation and reuse

Use a small frontend-owned deterministic timeline and an isolated sample snapshot
conforming to the existing presentation types. Sample observations, timestamps,
counts and incidents must agree at every stage. Do not derive sample hazards only
from a selected tile or animate disconnected UI decorations.

- Reuse existing dashboard, condition adapter, visualizer, map and alert components.
- Do not POST sample readings, mutate scenarios, acknowledge/resolve real incidents,
  register hardware, or change SQLite data while playing samples.
- Stop live polling while Demo scenarios is active. Ignore/cancel late live responses
  and give each playback run a fresh identity so old timers cannot change a new run.
- Keep incident tracking and audio bookkeeping isolated from the live session.
  Baseline sample data is silent; new sample critical incidents can use the existing
  opt-in sound policy. Sounds remain off by default and never bypass browser consent.
  On Restart/new scenario, discard pending audio/timers from the old run.
- Preserve measurement semantics: acknowledgement does not clear hazards, and normal
  readings do not automatically resolve incidents. For this initial playback scope,
  incident acknowledgement/resolution and simulator writes are unavailable in demo
  mode, with clear explanation. Returning to Live restores normal controls.
- Preserve basic node inspection. If a sample detail/history view is exposed, supply
  sample node/history data locally; never fetch a real node's history for sample data.
  Implementing a new chart experience is out of scope.
- Reduced-motion preferences keep the scenario's data progression, static hazard
  positions and explanatory labels while suppressing decorative motion.

## Connection failure and presentation truthfulness

Demo entry and playback must not wait for ESP32, API health, summary or node responses.
Show a persistent Simulated demonstration label, selected scenario and stage/progress.
Sample timestamps represent the demonstration run and must not be described as device
receipt times. Live API outage messaging must not obscure an operational sample view.

The existing frontend must still be served/loaded in the browser. This design does
not add service-worker caching, an installable offline app, or a guarantee that a
closed website can reopen after its frontend server stops. It does guarantee that
an already-loaded sample dashboard runs when the API or ESP32 is unavailable.

Reuse locally available assets. OpenStreetMap tiles may need internet; unavailable
tiles must not stop samples, markers/locations, incident lists or the cutaway.

## Non-goals

No report generation now; the supplied report is a reference for later work.
No firmware changes, hardware calibration, production hosting, second site, new
streaming transport, scenario editor, automatic repeating, or full playback controls.
No commit, push or merge without the user's explicit authorization.

## Verification required after implementation approval

- Demo entry works with all API requests blocked from initial page load.
- Each scenario automatically reaches the expected labels, values, counts, markers
  and alerts, including overlapping hazards and partial recovery.
- Restart and scenario switching reset cleanly; stale timers/live responses cannot
  alter the active run. Completion holds its final state.
- Playback performs no API mutations and hardware/SQLite data remains untouched.
- Demo node inspection stays local; live return restores real fetching and honest
  errors. Repeated mode switches do not duplicate polling or audio.
- Existing reduced-motion and explicit audio-consent behavior remain valid.
- Frontend lint, typecheck, build and appropriate existing/new browser checks pass.
- Visually inspect desktop presentation with the backend unavailable and record
  actual outcomes in PROJECT_STATE.md after verified implementation.

## Approval boundary

Review this design before implementation. Exact code organization and modest visual
placement are left to the builder within the existing architecture. Once approved,
write the implementation plan and then build the agreed scope.
