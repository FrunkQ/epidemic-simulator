# Epidemic Simulator: Architecture

Owner: the project coordinator. Every build thread follows this file. Where it conflicts with the original spec Alex posted in the project chat (7 Oct 2026), this file wins. To change a rule, edit this file in the same PR and say why; never drift silently.

## 0. Product shape (from Alex)
- Guiding principle, in Alex's words: "Simple interface gives it understanding, real data in the back gives it weight." Every screen stays simple; every number behind it is sourced.
- Audience: ordinary people. Every word on screen is plain language. An "About" page explains what the simulator is and how it works in plain words, and cites every paper and dataset behind the numbers (title, authors, year, journal, DOI or link) so anyone curious can look them up. Each preset links to its entries there ("Where do these numbers come from?").
- Reference look: the map mockup (dark stylised map, populations as discs of dots, dashed air arcs, a control card per population, legend, small live charts). The impact-summary mockup is a secondary panel.
- Each population is controlled separately: lock down one, change vaccination in another.
- Starting view: a microcosm of 3 cities, one of them across a single sea strait (loosely London / Paris / Berlin, kept abstract). Everyone starts here, and most people will only ever play with this.
- People who want more can zoom out to a larger, procedurally generated world and add populations (cities, and rural areas between them), using it as an experimental tool.
- People can bring in their own real numbers: vaccination rates and population density for their country or area, taken from public databases.

## 1. Hard rules
1. `src/lib/sim/**` is plain TypeScript: no imports from svelte, `$app`, or the DOM. Only `render.ts` touches a `CanvasRenderingContext2D`, which is passed in.
2. Svelte never holds or loops over dots. It sends commands and reads a telemetry snapshot about 10 times a second.
3. All simulation rules live in the engine. The UI never decides an outcome (hospital overload, deaths, who travels).
4. All randomness goes through the seeded RNG in `rng.ts`. No `Math.random()` anywhere under `src/lib/sim`.
5. Fixed timestep: the sim advances in ticks, not frames. A 120 Hz screen must not run the epidemic faster.
6. No allocations in per-tick, per-dot code: no `filter`, `map`, spread, object literals or closures in the hot loop.
7. Config durations are in days and are converted to ticks once, when a disease or scenario loads.
8. Two modes. **Setup**: edit populations, map, disease, vaccination, travel. **Run**: the epidemic plays. Any Setup change restarts the run from day 0. Interventions (lockdown, flights, borders, testing, speed) are live during Run.

## 2. Time
- `TICKS_PER_DAY = 30`. Normal speed is 60 ticks per real second (2 sim days per second). Speed control: pause, 0.5x, 1x, 2x, 4x.
- Loop: one `requestAnimationFrame`. An accumulator turns elapsed real time into ticks due; run at most 8 ticks per frame (drop the rest); render once per frame.
- Disease durations come from the research sheet. Rough scale: measles contagious about 4 days before the rash and ill about 7; flu silent 1 to 2 days, ill about 5; polio sheds for weeks.
- Travel times are set in days on each route: air 0.5 to 1 day; ferry and road long enough that a typical measles case burns out on the way (longer than silent + ill days, so 14 or more). Speed is derived: route length / (travelDays x TICKS_PER_DAY).

## 3. Data layout
A fixed pool of `MAX_AGENTS = 6000` dots in typed arrays, allocated once (structure of arrays):
- `x, y, vx, vy`: Float32Array
- `state`: Uint8Array. 0 SUSCEPTIBLE, 1 SILENT, 2 SYMPTOMATIC, 3 RECOVERED, 4 DECEASED
- `protection`: Uint8Array. 0 NONE, 1 PARTIAL, 2 FULL (vaccination level, kept separate from state)
- `vaccineWorks`: Uint8Array. Vaccines are all-or-nothing: at spawn (and whenever protection changes) each vaccinated dot rolls once against its disease's efficacy for its protection level; 1 means fully protected, 0 means the vaccine didn't take and the dot can catch it like anyone else.
- `speed`: Float32Array (each dot's own wandering speed). `waneTicks`: Int32Array (ticks until this dot's protection next drops a level; drawn from an exponential distribution with mean `waningDays` when protection is set; -1 when waning is off).
- `asymptomatic`, `isolated`, `essential`: Uint8Array flags
- `region`: Int16Array (-1 while travelling)
- `stateTicks`: Int32Array (ticks left in the current state)
- `fatigueTicks`: Int32Array (how long this dot tolerates lockdown; drawn at spawn)
- `route`: Int16Array (-1 when not travelling), `routeS`: Float32Array (distance along the route), `routeDir`: Int8Array (+1 or -1), `routeSeg`: Int16Array (current segment)
- `infectedTick`, `infectedBy`: Int32Array (so a dot cannot spread on the tick it caught it, and for measuring R0)
- `activeCount`: slots [0, activeCount) are in use.
- Each dot stands for `peoplePerDot` people, shown in the UI ("each dot = about N people"). When added populations would exceed MAX_AGENTS, `peoplePerDot` rises so the total stays within budget, with a minimum of 30 dots per population.
Deceased dots stay where they died, drawn grey, skipped by movement and transmission.
Regions and routes are short arrays of plain objects (tens, not thousands), which is fine.

## 4. World, populations and routes
- The world is a seeded procedural map larger than the screen (e.g. 4800 x 2700 world units). Before building one, spend a short time looking for a maintained, permissively licensed procedural map generator that can also suggest sensible places for settlements; use it if it is small and fits. Otherwise use this recipe in `geography.ts` (pure and deterministic from a seed): a heightmap from 2D simplex noise (npm `simplex-noise`, driven by our seeded RNG) with domain warping and an edge falloff; a sea-level threshold gives land and water; coastline polygons via marching squares (npm `d3-contour`), simplified.
- Suggested population sites come from a suitability score (on land, low ground, near the coast, not too close to other sites) spread out with Poisson-disc sampling. The Add population tool highlights good spots, and an Auto-fill button can populate the world with sensible cities and rural areas.
- The starting microcosm is guaranteed, not left to chance: the default start seed comes from a short curated list whose start area has an island and a mainland separated by one strait narrow enough for a ferry, with the 3 cities placed there. A test checks every curated seed meets this.
- Camera: pan and zoom (wheel, pinch, and on-screen buttons), starting framed on the microcosm. All drawing goes through the camera transform. Dots outside the view are skipped when drawing but still simulated. Coastlines are cached `Path2D` shapes drawn each frame, not one giant offscreen bitmap. The engine exposes `worldToScreen` and `screenToWorld` including the camera; overlays and clicks use them, never raw pixels.
- Scenario (`config/scenarios.ts`): map seed, `regions`, `routes`.
- Region: `{ id, name, kind: 'city' | 'rural', cx, cy, population, density, radius (derived), hasAirport, vaccinatedFull, vaccinatedPartial, hospitalCapacity, hub? }`.
  - Radius comes from the number of dots and a sim density: `radius = sqrt(dots / (simDensity x PI))`, with `simDensity` in dots per world unit², clamped to a sensible range. Using dots (not people) keeps the contact rate at the calibrated level whatever `peoplePerDot` is. Real density (people per km²) maps to `simDensity` as in 4.1. City default: dense, has an airport and a gathering hub. Rural default: small, sparse, no airport, no hub.
  - Density acts only through how often dots meet. Never add a density multiplier to the infection chance. Sparse rural areas spread slower because dots meet less.
- Adding a population (Setup mode): the user picks city or rural, clicks a spot on land, and sets size and density. Validation: centre on land, disc mostly on land, no overlap with other discs, total population at most MAX_AGENTS (the UI shows the remaining budget). Users can also remove or resize populations.
- Route generation (rerun whenever populations change):
  - Ground: connect each population to its 2 nearest neighbours (no duplicates). If the straight line stays on land it is a `road`. If it crosses water no wider than `MAX_FERRY_GAP` it is a `ferry`. Otherwise there is no ground link.
  - Air: between every pair of populations that have airports (cities by default).
  - Routes are polylines; roads get a gentle curve for the winding look. Precompute cumulative segment lengths.
- Water is a barrier by construction: dots stay inside their own disc and the only way between populations is a route. No per-dot land checks at runtime; the land shapes are used only for validation, route generation and drawing.

### 4.1 Real-world numbers
- "Use real numbers" on a population card: pick a country (and a region where data exists) and the card fills in vaccination rates and density. People can also type their own numbers, or paste or upload a CSV with columns `name, population, density_per_km2, full_pct, partial_pct`.
- Data comes from a bundled snapshot built by `scripts/fetch-data.ts` from public sources: WHO/UNICEF immunisation coverage estimates (e.g. measles first and second dose, polio third dose; flu where available) and World Bank population density. Commit the output as `src/lib/config/realData.generated.json` with source names, indicator codes and data year, and list them on the About page. The app never calls these services at runtime; refresh by rerunning the script.
- Mapping to the sim: vaccination percentages map directly (full = completed course, partial = started but not completed). Real density (people per km²) maps to sim density on a log scale clamped to the sim's range, so a dense city looks crowded and farmland looks sparse. The card shows the real figure, not the sim value.
- The country presets in the spec (e.g. Bahrain, United States, Montenegro) come from this same data, never hard-coded numbers.

## 5. Tick order (engine.ts; never reorder)
1. Apply queued commands.
2. Departures.
3. Movement (in a region and in transit).
4. Rebuild the spatial grid.
5. Transmission.
6. Disease clocks and transitions (including deaths and hospital load).
7. Waning immunity.
8. Update telemetry counters. (Publishing to the UI is time-based, from the loop, about 10 Hz.)

## 6. Mechanics
### 6.1 Transmission
- One uniform grid per region, covering that region's disc bounding box (dots in different regions never meet, because discs don't overlap). Cell size = the disease's transmission radius. Rebuild every tick with a counting sort into preallocated `cellStart` / `cellItems` Int32Arrays, clearing only that region's cells. Only dots in a region go in; travellers don't. (A single whole-world grid was measured at about 0.9 ms per tick just clearing cells, and grows with the zoomed-out world.)
- For each infectious dot (SILENT or SYMPTOMATIC, with `infectedTick < tick`), scan the 3x3 neighbouring cells. For each SUSCEPTIBLE dot within the radius that is not protected (`vaccineWorks = 0`): chance = `beta`. On success, infect it.
- Vaccine model: all-or-nothing per disease, using published efficacy for full and partial courses, from the evidence table (e.g. measles 0.97 / 0.93, polio 0.99 / 0.5, flu 0.4 / 0.2). A leaky model (lower chance on every contact) was tried and rejected: repeated contacts wore protection far below the published efficacy. Partly vaccinated dots that still catch it are ill half as long and never die.
- `beta` is a per-tick chance calibrated so the sim's measured R0 matches the disease's research R0 (see section 6.9). Never hand-tune it.
- Green dots are not physical walls and there is no dot-to-dot collision. The "wall of immunity" appears because infectious dots waste their contacts on protected dots.

### 6.2 Course of illness
- On infection: `state = SILENT`, `stateTicks = silentDays`, `asymptomatic = rng < disease.asymptomaticFraction` (polio 0.96: WHO/CDC give 72% with no symptoms plus 24% with a mild illness, and both carry on as normal; measles and flu about 0).
- A SILENT dot behaves exactly like a healthy dot: it moves, travels, and obeys lockdown like everyone else, because it does not know it is ill.
- When SILENT ends: an asymptomatic dot stays SILENT for its remaining contagious period (`illDays` more), then becomes RECOVERED without ever turning red. Otherwise it becomes SYMPTOMATIC for `illDays` (halved if PARTIAL).
- SYMPTOMATIC: speed 0, still contagious to dots that wander into it, never boards transport. If this happens mid-route, the dot stops on the route and its clock keeps running.
- End of illness: dies with chance `mortality x (region overloaded ? 3 : 1)`. PARTIAL dots never die (mockup: "mild symptoms, won't die"). Otherwise RECOVERED, which is immune.

### 6.3 Waning immunity
- Each disease has `waningDays` from research (measles is close to lifelong, so effectively off; flu is short). Do not invent waning where research says there is none; the booster lesson shows with flu.
- Steps: FULL to PARTIAL to NONE; RECOVERED to SUSCEPTIBLE with PARTIAL. Each protected dot counts down `waneTicks`; at zero it drops a level and draws a new countdown.
- When a dot's protection drops a level, a working vaccine stays working with chance `efficacyNew / efficacyOld`; a vaccine that didn't take never starts working. Waning can only lower protection.

### 6.4 Lockdown (per region)
- `essential` is fixed at spawn for 10% of dots. On lockdown, all other dots stop.
- The region keeps `lockdownTicks`, which rises while locked and falls at the same rate after lifting. A frozen dot breaks quarantine and wanders again once `lockdownTicks > fatigueTicks` (drawn at spawn, e.g. mean 30 days, sd 10; research may refine). Dots within about 3 days of their limit jitter as a visual warning.
- Lockdown also cancels that region's gatherings and stops non-essential departures from it.

### 6.5 Gathering hub
- Cities have a hub point. For part of each sim day (e.g. day fraction 0.4 to 0.6) moving dots get a weak pull toward the hub, then disperse. Clamp speed. Off under lockdown.

### 6.6 Hospital load
- The engine counts SYMPTOMATIC dots per region each tick. `overloaded = count > hospitalCapacity` (a share of the region's population, never an absolute number, so it scales when people add or resize populations; the default share is sourced, and step 4 can take hospital beds per 1,000 people from World Bank data). Telemetry carries the flag and capacity; the UI flashes a warning and the chart draws the capacity line.

### 6.7 Mass testing (per region)
- Finds every SILENT dot infected more than 1 day ago (including asymptomatic ones) and sets `isolated = 1`: speed 0, no travel, drawn red. Their illness course and death chance do not change.
- Cooldown (e.g. once per 7 sim days) and a radar-sweep animation.

### 6.8 Travel
- Each route has `kind`, `from`, `to`, points, `travelDays`, `tripsPerDay` (scaled by the Travel slider), `open`, and for ground routes an optional `barrierS`.
- Departures: Poisson per route per tick using the RNG, with equal rates both ways so populations stay roughly level. Eligible: alive, not SYMPTOMATIC, not isolated, not frozen by lockdown.
- Air: travellers board a plane (up to K seats) leaving on a schedule; draw the plane, hide the passengers, release them at the destination. Road and ferry: dots visibly move along the route.
- Grounding flights: no new departures; planes in the air land. Closing a border: a barrier is drawn at `barrierS`; travellers reaching it turn back; no new departures.
- Arrival: the dot is placed just inside the destination disc at the route end with a random velocity, and `region` is set.

### 6.9 Calibration
- `scripts/calibrate.ts` (Node, headless): for each disease, seed index cases into a fully susceptible city, measure secondary infections via `infectedBy`, and binary-search `beta` to the target R0. Write the results to `config/diseases.generated.ts`.
- Target R0 is the research value. If dot density cannot reach it (measles about 15), raise `transmissionRadius`; never weaken the lesson. The herd-immunity line shown to users is `(1 - 1/R0) / fullEfficacy`. If that is above 100% (e.g. flu, where the vaccine is about 40% effective), the UI says in plain words that vaccination alone can't stop it, rather than showing an impossible target.
- Calibration keeps adding seeds until the standard error of the measured R0 is under 2% of the target (low-R0 diseases like flu need many more seeds). The generated file's header records seeds used, index cases, and the measured R0 with its standard error.
- A test re-measures R0 at the committed `beta` and fails if it is outside the target by more than 3 standard errors, so the committed numbers can't silently drift from the script.
- `herdCoverage(disease)` is a pure function in config returning `{ coverage: (1 - 1/R0) / fullEfficacy, reachable: coverage <= 1 }`. The UI only displays it.

### 6.10 Citations
- Every research-derived number in config carries the ids of its sources, e.g. `r0: { value: 15, sources: ['guerra2017'] }`. Full references live in `src/lib/config/citations.ts` (id, authors, title, journal, year, DOI or URL, what was taken from it).
- The About page is generated from `citations.ts` plus the data-source entries in `realData.generated.json`, so it cannot drift from the numbers in use. A test fails if any config number lacks a source id, or a source id has no entry in `citations.ts`.
- Each entry in `citations.ts` also records: `usedFor` (which config numbers), `quote` (the exact sentence or table value the number comes from), `location` (page, table or figure), `why` (one line on why this source and not another), `context` (population, country, era the data comes from), and `verified` (`{ by, on, ok }`).
- Source preference: systematic reviews and meta-analyses, then authoritative bodies (WHO position papers, CDC Pink Book, ECDC), then single studies. Older classic papers are fine for measles, polio and flu when they are still the standard reference; say so in `why`.
- COVID-era research is used for the human-behaviour and intervention mechanics (lockdown adherence and fatigue, mass testing, hospital strain), not as a stand-in for other diseases' parameters. Mark such entries `context: 'COVID-19 era'`.
- Double-check rule: every citation is verified by a separate pass that did not gather it. The checker opens the source itself and confirms the DOI or link resolves to that paper, that title, authors and year match, that the quoted value is really there at `location`, and that the paper has not been retracted. Anything that fails or can't be opened is removed or replaced, never kept unverified. A test fails if any entry has `verified.ok !== true`.
- Before numbers are locked in step 1, the evidence is also written up as a plain table for Alex to review at /mnt/project-files/research/evidence.md: number, value used, source, quote, why.
- "Every research-derived number" includes behaviour constants (lockdown fatigue, hospital share, gathering timing), not just disease parameters: they live in sourced config, never as bare constants. The citation test scans all config, fails on any research number that isn't in `{ value, sources }` form, and checks every required field (`usedFor` keys exist; `why`, `context`, `verified.by`, `verified.on` are non-empty). COVID-era entries use exactly `context: 'COVID-19 era'`. When a value is worked out rather than quoted, `quote` holds the facts it's worked from and `why` says how.

## 7. Engine API (all that Svelte sees)
```ts
const sim = createSimulation(scenario, { seed, diseaseId });
sim.step(ticks)            // advance; used by the loop and by tests
sim.render(ctx, viewport)  // dots, planes, barriers, sweeps
sim.send(command)          // queued, applied at the next tick
sim.snapshot(): Telemetry  // cheap copy, called about 10 Hz
sim.setup(scenarioSetup)   // Setup change: restart at day 0; takes diseaseId, the engine loads the disease itself
sim.view                   // worldToScreen / screenToWorld

type Command =
  | { type: 'lockdown'; region: number; on: boolean }
  | { type: 'flights'; on: boolean }
  | { type: 'route'; route: number; open: boolean }
  | { type: 'massTest'; region: number }
  | { type: 'speed'; value: 0 | 0.5 | 1 | 2 | 4 }
  | { type: 'seed'; region: number; count: number };
```
Telemetry: `{ day, regions: [{ id, counts per colour, overloaded, capacity, lockedDown, fatiguedShare, testCooldown }], totals, latest (this day's history sample per region), historyVersion, events (last 100 only) }`. Snapshots stay small and fixed-size; they never copy the full history. Charts call `sim.history(regionId)`, which returns the typed ring buffers (read-only) only when `historyVersion` has changed. The UI keeps the snapshot in `$state.raw` and replaces it whole on each publish.

## 8. Rendering
- Dots: small squares or circles batched by colour (one fill per colour per frame).
- Colour priority: DECEASED grey; SYMPTOMATIC or isolated red; SILENT orange; RECOVERED purple; otherwise by protection: FULL green, PARTIAL yellow, NONE blue. Make sure orange and yellow are clearly different (and colour-blind safe); give infectious dots a faint pulse ring.
- Charts: small canvas line charts drawn from `history`; no SVG chart library, no animation. Hospital capacity is a dashed line.
- Control cards float over each population via `worldToScreen`, as in the mockup; on small screens they collapse to a tap-to-open card.

## 9. Files
```
src/lib/sim/     constants.ts rng.ts types.ts agents.ts grid.ts disease.ts movement.ts transit.ts routes.ts geography.ts interventions.ts telemetry.ts render.ts engine.ts camera.ts
src/lib/config/  diseases.ts diseases.generated.ts scenarios.ts realData.generated.json citations.ts
src/lib/ui/      SimCanvas.svelte RegionCard.svelte TopBar.svelte SetupPanel.svelte Legend.svelte Charts.svelte ImpactPanel.svelte
src/routes/      +page.svelte (ssr off), about/+page.svelte
scripts/         calibrate.ts fetch-data.ts
tests/sim/       *.test.ts
docs/            ARCHITECTURE.md (this file)
```
SvelteKit with Svelte 5 runes and adapter-static (site prerendered, the simulation page client-only).

## 10. Tests (CI must be green on every PR: lint, typecheck, vitest)
- Determinism: same seed and same commands give identical counts on day 100.
- Speed: 5,000 dots mid-outbreak, `step(1)` averages under 4 ms in Node. In the browser, a dev-only FPS counter.
- Lesson tests (headless, about 20 seeds each, assert on the share of seeds):
  1. Measles, one imported case into a 5,000-dot city: at 98% full coverage it fizzles (under 5% of unprotected dots infected) in at least 80% of seeds; at 85% it takes off (over 30% of unprotected dots infected) in at least 80% of seeds. Count only dots the vaccine does not protect. (96% coverage is about 93% immune, right on the threshold, so it is deliberately not tested.) The imported case itself is not counted, and the denominator is the actual number of dots with `vaccineWorks = 0`.
  2. A measles case leaving while silent by plane lands still infectious in at least 90% of trials; by ferry it arrives no longer infectious in at least 90%.
  3. Lockdown at day 5 lowers the peak number of red dots.
  4. Mass testing lowers total infections.
  5. Hospital overload raises deaths per case.
  6. Polio: at least 90% of infections never turn red.
  7. The same population at low density has a lower attack rate than at high density by day 60.
  8. Map generation is identical for the same seed.
  9. Every curated start seed yields the microcosm: island plus mainland, one ferry-width strait, 3 cities in the start view.
- If a lesson test fails, fix the model or the calibration. Never loosen a threshold without updating this file and telling Alex.

## 11. Build order (one PR per step)
1. Headless engine: constants, rng, agents, grid, disease, in-region movement, calibration script, citations file, determinism, speed and herd-immunity tests; a bare canvas page to watch it.
2. Map and travel: procedural map, curated start seeds, camera, the 3-city microcosm, route generation, transit, region cards, legend, charts.
3. Interventions and modifiers: lockdown with fatigue, flights, borders, testing, hospital load, hubs, waning; lesson tests 2 to 6.
4. Experimental mode: zoom out, add, remove and resize populations (city or rural, size, density), suggested sites and Auto-fill, route regeneration, real-world numbers (fetch-data script, country picker, CSV import); lesson test 7.
5. Impact panel, About page with full citations, polish, deploy.

## 12. Decisions that change the original spec
- The infection chance per tick is calibrated to R0 (the spec treated R0 as a per-collision probability).
- Silent dots obey lockdown like healthy dots (the spec said they ignore it).
- Mass testing isolates silent dots without changing their illness or death chance (the spec turned them SYMPTOMATIC, which would make symptom-free polio cases roll for death).
- Lockdown's essential 10% is fixed per dot (the spec's position formula changes every frame).
- Hospital overload is computed in the engine, not in Svelte.
- Travel moves at a set speed along the route path (the spec used a fixed progress step on a straight line, so every trip took the same time whatever the distance).
- Setup changes restart the run; interventions are live.
- Vaccines are all-or-nothing using each disease's published efficacy (the spec had green dots never catching it and partial cutting the chance by 60%). Partly vaccinated dots that catch it are ill half as long and never die. Alex chose real vaccine figures over simplified ones (7 Oct).
- Regions use their own spatial grids instead of one whole-world grid, and disc size comes from dot count and sim density (7 Oct, after the step 1 review).
