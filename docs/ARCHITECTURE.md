# Epidemic Simulator: Architecture

Owner: the project coordinator. Every build thread follows this file. Where it conflicts with the original spec Alex posted in the project chat (7 Oct 2026), this file wins. To change a rule, edit this file in the same PR and say why; never drift silently.

## 0. Product shape (from Alex)
- Guiding principle, in Alex's words: "Simple interface gives it understanding, real data in the back gives it weight." Every screen stays simple; every number behind it is sourced.
- Second principle (Alex, 7 Oct): each subsystem is simple and explained on its own; complexity and feedback loops emerge only from combining them ("this is more complicated than you thought"). Rule: lessons must emerge from the subsystems. No scenario-specific code, and lesson tests may set inputs only, never engine internals.
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
- `ageBand`: Uint8Array. 0 = aged 0-14, 1 = 15-64, 2 = 65+ (the World Bank bands), drawn at spawn from the region's age mix.
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
- Region: `{ id, name, kind: 'city' | 'rural', cx, cy, population, density, radius (derived), hasAirport, vaccinatedFull, vaccinatedPartial, hospitalBedsPerThousand, hub? }`.
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

### 4.2 Health policy (per population)
- Each population has a "Health policy" card. Every behaviour and healthcare number is a slider on it, and every slider starts from a real-world preset; people can what-if from there at any time.
- Fields, each stored as `{ value, sources }` like other config: age mix (share aged 0-14 and share 65+, from World Bank SP.POP.0014.TO.ZS and SP.POP.65UP.TO.ZS; 15-64 is the remainder), `hospitalBedsPerThousand`, `spareBedShare`, lockdown compliance (the share who stay home; today a fixed 90% via `ESSENTIAL_SHARE`), lockdown fatigue days, testing reach and cooldown, travel frequency, and vaccination full and partial per disease.
- Country presets are bundled by `fetch-data.ts`: World Bank beds per 1,000, Eurostat or OECD occupancy, WHO/UNICEF coverage. Compliance and fatigue come from COVID-era sources (e.g. mobility or stringency data), marked `context: 'COVID-19 era'`.
- General default: 5.07 beds per 1,000 (EU average, Eurostat 2024) and 10% spare (NHS England occupancy), with the existing citations. The UK preset uses UK bed figures once sourced, since 5.07 is the EU average, not the UK's (Alex was told this on 7 Oct).
- "Similar to": after any slider change the card shows the closest bundled country profile (nearest neighbour on normalised fields), or "Custom" if none is within a set distance.
- Where presets live (the engine only ever receives a resolved `HealthPolicy` per region and never knows about countries):
  - `config/countryProfiles.generated.json`, written by `scripts/fetch-data.ts`: per-country beds per 1,000, bed occupancy (giving `spareBedShare`), vaccination coverage per disease and density, each with source, indicator code and year.
  - `config/behaviourPresets.ts`, hand-sourced: fields no bulk dataset gives per country (lockdown compliance, fatigue days, testing reach) in `{ value, sources }` form with `citations.ts` entries. Countries without their own figure fall back to a sourced general default, and the card says "general estimate".
  - `config/healthPolicy.ts`: the `HealthPolicy` type, `presetFor(country)` (merges the two files), `similarTo(policy)` and the general default. Steps 2 and 3 use the general default.
- Live vs restart: sliders that don't change who exists or who is vaccinated (beds, spare share, compliance, fatigue, testing, travel) apply live during a run. Population, density, age mix and vaccination changes restart from day 0 (rule 1.8 stands).
- Every slider and card has a one-line plain-English "what this means" explainer, taken from the same citation entry. The About page has one short section per subsystem.

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
- Age (Alex, 7 Oct): `mortality` and `hospitalisedShare` are per age band (0-14, 15-64, 65+), sourced per disease. Three bands, not a single cutoff, because several lessons turn on children or young adults (measles and polio deaths in young children, chickenpox worse in adults, 1918 flu killing healthy young adults). Each band-rate source records its reference population so test 16 can check the bands. Where a source gives only an overall rate, derive the bands from a sourced age ratio and mark them worked out; if even that doesn't exist, use the same value in all bands and the About page says so. Mixing is the same for all ages (no contact matrix), so R0 calibration is unaffected; the About page names "who meets whom by age" as not modelled. Vaccination coverage is the same in every band (WHO figures are childhood coverage), and the About page says so.
- Vaccine protection has two parts. `infection` stays all-or-nothing via `vaccineWorks`, as before. `severe` applies to a vaccinated dot whose vaccine didn't stop infection: its death chance and hospitalisedShare are multiplied by (1 - severe). Against new strains, vaccines mostly keep people out of hospital rather than stopping infection, and updated vaccines do both better; this is the honest part of the lesson. This replaces the old "partly vaccinated never die" rule. Where a disease has no sourced severe protection, keep today's behaviour (partial: severe = 1, ill half as long), marked as the existing default in the evidence table.
- End of illness: dies with chance `mortality[ageBand] x (1 - severe for vaccinated dots) x (region overloaded ? 3 : 1)`. Otherwise RECOVERED, which is immune.

### 6.3 Waning immunity
- Each disease has `waningDays` from research (measles is close to lifelong, so effectively off; flu is short). Do not invent waning where research says there is none; the booster lesson shows with flu.
- Steps: FULL to PARTIAL to NONE; RECOVERED to SUSCEPTIBLE with PARTIAL. Each protected dot counts down `waneTicks`; at zero it drops a level and draws a new countdown.
- When a dot's protection drops a level, a working vaccine stays working with chance `efficacyNew / efficacyOld`; a vaccine that didn't take never starts working. Waning can only lower protection.

### 6.4 Lockdown (per region)
- `essential` is fixed at spawn for a share of dots set by the region's policy (lockdown compliance, 4.2; default 10% essential). On lockdown, all other dots stop.
- The region keeps `lockdownTicks`, which rises while locked and falls at the same rate after lifting. A frozen dot breaks quarantine and wanders again once `lockdownTicks > fatigueTicks` (drawn at spawn, e.g. mean 30 days, sd 10; research may refine). Dots within about 3 days of their limit jitter as a visual warning.
- Lockdown also cancels that region's gatherings and stops non-essential departures from it.

### 6.5 Gathering hub
- Cities have a hub point. For part of each sim day (e.g. day fraction 0.4 to 0.6) moving dots get a weak pull toward the hub, then disperse. Clamp speed. Off under lockdown.

### 6.6 Hospital load
- Each region has `hospitalBedsPerThousand` (sourced; default 5.07, Eurostat 2024; step 4 can take country values from World Bank data). Only spare beds count: `capacity = dots x hospitalBedsPerThousand / 1000 x spareBedShare`, where `spareBedShare` (1 minus normal bed occupancy) is sourced too. Capacity is in dots, the same unit as the counts; the UI may show it in people by multiplying by `peoplePerDot`.
- Each disease has a sourced `hospitalisedShare` (the share of symptomatic cases needing a hospital bed). The engine counts SYMPTOMATIC dots per region each tick; `overloaded = symptomatic x hospitalisedShare > capacity`. Telemetry carries the flag and capacity; the UI flashes a warning and the chart draws the capacity line.
- Capacity and pressure (Alex, 7 Oct: plain words a lay person understands). Each population shows two headline readings. **Capacity** is fixed: one plain rating built from the detail sliders underneath (beds per 1,000 and normal occupancy; collapsed by default). **Pressure** moves: a gauge from 0 to 100%+ with three plain bands, "Coping", "Under pressure", "Overwhelmed".
- `pressure = (beds normally occupied + epidemic patients) / total beds`, where epidemic patients = SYMPTOMATIC dots x hospitalisedShare, summed over every circulating disease. A UK-like preset therefore starts the run already "Under pressure".
- Deaths under strain: replace the hard 3x overload step with a sourced curve. The death multiplier is 1 up to a threshold and rises with pressure above it, capped at a sourced maximum (COVID-era research is fine here). If only a single figure exists, use it as the cap and say so. The 3x from the spec has no source.
- Agreed curve (7 Oct): `multiplier = min(strainMaxMultiplier, 1 + strainSlope x max(0, pressure - strainThreshold))`, with `behaviour.strainThreshold` 0.85 (Wilde 2021), `behaviour.strainMaxMultiplier` 2.0 (Kadri 2021, Bravata 2021) and `behaviour.strainSlope` 4.0 (worked out: no study gives a slope; it matches Wilde's OR 1.23 over the 85-100% band). It reaches the cap at 110% pressure. The explainer says that above 100% means patients beyond the normal beds. These are cohort studies, so they carry a `noReviewReason` unless a systematic review replaces them.
- Telemetry carries pressure and its band per region; the chart draws pressure with the band lines.
- Step 3 must show the line is meaningful in the default scenario: with no interventions, at least one common disease (e.g. measles or COVID-19) crosses it, and flattening the curve with lockdown keeps it under for at least part of the run. If real numbers can't show that, report it to Alex rather than fudging the numbers.

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
- A test re-measures R0 at the committed `beta` on fresh seeds and fails if it is outside the target by more than 3 standard errors (the fresh measurement's and the calibration's combined, since both are noisy), so the committed numbers can't silently drift from the script.
- `herdCoverage(disease)` is a pure function in config returning `{ coverage: (1 - 1/R0) / fullEfficacy, reachable: coverage <= 1 }`. The UI only displays it.

### 6.10 Citations
- Every research-derived number in config carries the ids of its sources, e.g. `r0: { value: 15, sources: ['guerra2017'] }`. Full references live in `src/lib/config/citations.ts` (id, authors, title, journal, year, DOI or URL, what was taken from it).
- The About page is generated from `citations.ts` plus the data-source entries in `realData.generated.json`, so it cannot drift from the numbers in use. A test fails if any config number lacks a source id, or a source id has no entry in `citations.ts`.
- Each entry in `citations.ts` also records: `usedFor` (which config numbers), `quote` (the exact sentence or table value the number comes from), `location` (page, table or figure), `why` (one line on why this source and not another), `context` (population, country, era the data comes from), and `verified` (`{ by, on, ok }`).
- Source preference: systematic reviews and meta-analyses, then authoritative bodies (WHO position papers, CDC Pink Book, ECDC), then single studies. Older classic papers are fine for measles, polio and flu when they are still the standard reference; say so in `why`.
- Evidence ranking (Alex, 7 Oct: "meta analysis put to top"). Each citation has `evidence`, ranked `meta-analysis` > `systematic-review` > `official` > `review` > `study` (`EVIDENCE_RANK` in citations.ts). Only peer-reviewed papers and official bodies are allowed: `official` needs a `publisher` from `OFFICIAL_PUBLISHERS` (WHO, CDC, ECDC, Eurostat, NHS England, World Bank, UN) and a `url`; every other kind needs a DOI, and preprint DOIs (10.1101, 10.21203) are refused. `url` always points at the original; a copy elsewhere goes in `mirrorUrl`. A number whose strongest source is a `review` or `study` needs a `noReviewReason` on that citation saying why nothing stronger is used (e.g. "no meta-analysis of Marburg R0"). When a meta-analysis disagrees with a single study, the meta-analysis sets the value and the study may appear as context. The About page sorts each number's sources strongest first, with a small plain badge: "Combines many studies" (meta-analysis, systematic review), "Official figure", "Review", "One study". The citation test enforces all of this.
- COVID-era research is used for the human-behaviour and intervention mechanics (lockdown adherence and fatigue, mass testing, hospital strain), not as a stand-in for other diseases' parameters. Mark such entries `context: 'COVID-19 era'`.
- Double-check rule: every citation is verified by a separate pass that did not gather it. The checker opens the source itself and confirms the DOI or link resolves to that paper, that title, authors and year match, that the quoted value is really there at `location`, and that the paper has not been retracted. Anything that fails or can't be opened is removed or replaced, never kept unverified. A test fails if any entry has `verified.ok !== true`.
- Before numbers are locked in step 1, the evidence is also written up as a plain table for Alex to review at /mnt/project-files/research/evidence.md: number, value used, source, quote, why.
- "Every research-derived number" includes behaviour constants (lockdown fatigue, hospital share, gathering timing), not just disease parameters: they live in sourced config, never as bare constants. The citation test scans all config, fails on any research number that isn't in `{ value, sources }` form, and checks every required field (`usedFor` keys exist; `why`, `context`, `verified.by`, `verified.on` are non-empty). COVID-era entries use exactly `context: 'COVID-19 era'`. When a value is worked out rather than quoted, `quote` holds the facts it's worked from and `why` says how.

### 6.11 Disease catalogue
- Diseases are pure config: adding one never touches engine code. Each needs the full sourced profile (R0, silent days, ill days, asymptomatic share, mortality, vaccine efficacy full and partial or "no vaccine", waning), verified per 6.10, calibrated per 6.9, and a one-line plain description.
- Catalogue (Alex, 7 Oct): the most common well-known diseases (e.g. measles, flu, COVID-19, chickenpox, mumps, rubella, whooping cough, polio), eradicated or historical ones (e.g. smallpox), and at least one very deadly, fast-acting disease (e.g. Ebola) to show that diseases which make people very ill very fast tend to burn out, because sick people stop moving and die before passing it far.
- The dropdown groups them in plain words: "Common", "Wiped out by vaccines", "Deadly but burns out fast", "Historic pandemics".
- 1918 flu ("Spanish flu", Alex 7 Oct) goes in "Historic pandemics" with three-band death rates; its unusual young-adult peak shows as a 15-64 rate out of line with 65+. The About page gives the reason only as the sources state it, since the cause is still debated.
- Mortality can be high (tens of percent). The model keeps one simple rule set: deceased dots never infect. Real exceptions (e.g. Ebola spreading at funerals) are named in plain words on the About page, not modelled.
- Wording must stay true. The lesson is "spreads less far", never "harmless": the About page notes that such diseases still cause deadly outbreaks where care is poor.
- Eradicated diseases start with today's reality (almost no one vaccinated against smallpox), which is itself a what-if worth showing.
- Variants are separate catalogue entries with their own sourced R0, timings and severity, e.g. "COVID-19 (2020 original)" and "COVID-19 (Omicron era)". The engine still sees one disease at a time, so variants need no engine change.
- Vaccine versions (Alex, 7 Oct: show why an up-to-date vaccine helps): each disease can list `vaccineVersions: [{ id, label, full: { infection, severe }, partial: { infection, severe } }]`, picked per population and defaulting to the updated version, every number sourced against that disease or variant (e.g. original vaccine vs Omicron, updated vaccine vs Omicron). The Health policy card has a "Vaccine version" picker; changing it restarts the run, because `vaccineWorks` is re-rolled.
- COVID-19 is required, not just an example. It is also the validation case: lesson tests 12 and 13 use the UK preset with real COVID-19 numbers.

### 6.12 Two diseases at once (Alex, 7 Oct: "winter flu and COVID hitting at once")
- `MAX_DISEASES = 2` circulating at once. Per-disease arrays become [slot x agent]: `state`, `stateTicks`, `asymptomatic`, `vaccineWorks`, `waneTicks`, `infectedTick`, `infectedBy`. Movement, age and region stay per agent.
- The diseases are independent except for three couplings, which are the feedback loops and must emerge, not be scripted: (a) a dot SYMPTOMATIC or isolated with either disease stops moving and doesn't travel; (b) hospital pressure is shared; (c) a dot can carry both at once. Whether co-infection changes severity comes from a sourced study; if nothing solid exists, there is no extra effect and the About page says so. Flu + COVID-19 (7 Oct): `coinfection.flu_covid19.mortalityMultiplier` is 1.0, because pooled meta-analyses (Guan 2021: OR 0.85, 0.51-1.43) show no clear effect on death. `hospitalisedMultiplier` follows a verified pooled ICU or critical-care figure, otherwise 1.0. The About page shows the UK cohorts' higher figures (Stowe 2021, Swets 2022) as context, and says plainly that the stronger evidence doesn't show them.
- Transmission: one grid build per tick (cell size = the larger radius), then one infection pass per disease with its own radius and beta. Calibration stays per disease, run alone; the coupled run is checked by a lesson test.
- Seasonality (winter making flu spread more) is a separate subsystem and is not modelled yet; the scenario starts both together and the About page says so. It is offered to Alex as a later add-on.
- Performance budget still applies: `step(1)` under 4 ms at 5,000 dots with 2 diseases.

### 6.13 Vaccine risk, shown honestly (Alex, 7 Oct: "lets not dance away the truths")
- Each vaccine version has sourced adverse-event rates per dose, per age band where sources give them (e.g. mRNA myocarditis in young adults, MMR febrile seizures, anaphylaxis): serious events needing hospital, and deaths, keeping the "per million doses" basis.
- Vaccines are a flat list per disease, each entry keyed by product and version, e.g. `{ product: 'mRNA', version: 'updated' }`, `{ product: 'adenovirus' }`, `{ product: 'OPV' }`, `{ product: 'IPV' }`. Infection and severe protection and the risk rates (`seriousRate`, `deathRate`) all live on each entry. The picker shows product first, then version where a product has more than one.
- `deathRate: null` means no death caused by the vaccine has been established. It is never summed or plotted as 0: HarmComparison shows the plain line "No deaths confirmed as caused by this vaccine", with the serious-event rate beside it where there is one. A test fails if a null rate reaches a numeric total.
- These are far too rare to show with 5,000 dots, so they are not rolled per dot. They are calculated from vaccinated people (dots x peoplePerDot x coverage, by band), and the panel says plainly they are calculated, not simulated.
- The impact panel shows, per 100,000 people, side by side: harm caused by the vaccine; harm from the disease in this run; harm from the disease if nobody had been vaccinated. The last is a counterfactual run (same seed and settings, vaccination 0) run headless at full speed in a Web Worker; the engine is pure and deterministic, so it needs no special code. Vaccine deaths are never hidden; they sit on the same scale as the disease's so people can see the difference themselves.
- Never on its own (Alex, 7 Oct): vaccine harm renders in exactly one component, `HarmComparison`, whose props are all required: vaccine-caused harm, disease harm in this run, disease harm with no vaccination (the counterfactual, which may be zero) and baseline deaths. All are per 100,000 people, over the same period and population, on one shared scale. A test fails if vaccine-harm figures are exported or rendered anywhere else.
- Baseline deaths: everyday all-cause deaths in that population over the same sim period, from sourced death rates by age band per country (UN World Population Prospects or WHO life tables; World Bank crude death rate as the fallback), weighted by the region's age mix.
- Two separate, labelled figures, never merged. "Expected everyday deaths in the weeks after vaccination" = vaccinated people x background rate x window. These happen anyway and are why "died after vaccine" reports exist (the observed-vs-expected method). "Deaths confirmed as caused by the vaccine" uses the sourced causal rates only. Do not say confirmed vaccine deaths were people about to die anyway: causal harms such as TTS and myocarditis mostly hit younger, healthy people.
- Wording: no "harmless" or "safe" claims. Numbers sit side by side with a one-line plain explainer per bar, and people compare for themselves.

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
Telemetry: `{ day, regions: [{ id, counts per colour, deaths per age band, overloaded, capacity, lockedDown, fatiguedShare, testCooldown }], totals, latest (this day's history sample per region), historyVersion, events (last 100 only) }`. Snapshots stay small and fixed-size; they never copy the full history. Charts call `sim.history(regionId)`, which returns the typed ring buffers (read-only) only when `historyVersion` has changed. The UI keeps the snapshot in `$state.raw` and replaces it whole on each publish.

## 8. Rendering
- Dots: small squares or circles batched by colour (one fill per colour per frame).
- Colour priority: DECEASED grey; SYMPTOMATIC or isolated red; SILENT orange; RECOVERED purple; otherwise by protection: FULL green, PARTIAL yellow, NONE blue. Make sure orange and yellow are clearly different (and colour-blind safe); give infectious dots a faint pulse ring.
- With two diseases (6.12), shape shows which disease: circle = none or disease A, diamond = disease B, hexagon = both; colour = the most serious state across both. The legend shows both.
- Charts: small canvas line charts drawn from `history`; no SVG chart library, no animation. Hospital pressure is drawn with its band lines.
- Control cards float over each population via `worldToScreen`, as in the mockup; on small screens they collapse to a tap-to-open card.

## 9. Files
```
src/lib/sim/     constants.ts rng.ts types.ts agents.ts grid.ts disease.ts movement.ts transit.ts routes.ts geography.ts interventions.ts telemetry.ts render.ts engine.ts camera.ts
src/lib/config/  diseases.ts diseases.generated.ts scenarios.ts realData.generated.json citations.ts
                 behaviour.ts herd.ts healthPolicy.ts behaviourPresets.ts countryProfiles.generated.json
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
  10. Deadly but fast (e.g. Ebola) versus measles, same starting city, flights on: the deadly disease reaches fewer other regions in at least 80% of seeds.
  11. Every disease in the catalogue passes the R0 re-measure test from 6.9.
  12. COVID-19 with the UK preset and no interventions overloads hospitals.
  13. COVID-19 with the UK preset: an early lockdown lowers the hospital overload peak.
  14. COVID-19, everything the same except age mix: an older population (about 29% aged 65+) has more deaths per infection than a younger one (about 3%) in at least 80% of seeds.
  15. Omicron-era COVID-19, same coverage: the updated vaccine gives fewer infections and fewer deaths than the original vaccine in at least 80% of seeds.
  16. Age-band check (config test): for each disease with band rates, the band rates weighted by the source's reference population reproduce the published overall rate within its uncertainty.
  17. 1918 flu vs seasonal flu: the 15-64 band has a higher death rate per infection under 1918 flu in at least 80% of seeds.
  18. Flu and COVID-19 together with a UK-like preset reach a higher peak hospital pressure than either alone, in at least 80% of seeds. For "close to reality", compare the shape qualitatively with a sourced UK winter (e.g. 2022/23 hospital occupancy); no curve fitting.
- Config test: a vaccine `deathRate` of null never reaches a numeric total; HarmComparison shows the "No deaths confirmed as caused by this vaccine" line instead.
- Test time budget: the full suite must stay under 5 minutes in CI. Run seeds in parallel (vitest threads) and size seed counts from the standard-error rule rather than fixed large counts.
- If a lesson test fails, fix the model or the calibration. Never loosen a threshold without updating this file and telling Alex.

## 11. Build order (one PR per step)
1. Headless engine: constants, rng, agents, grid, disease, in-region movement, calibration script, citations file, determinism, speed and herd-immunity tests; a bare canvas page to watch it.
1b. Disease catalogue: research, verify and calibrate the extra diseases in 6.11 as its own PR (config, citations and evidence table only, no engine changes). It can run alongside step 2. A small config-only follow-up adds the COVID-19 variants, 1918 flu, the vaccine-version numbers, the vaccine adverse-event rates and general background death rates by age band (country values come in step 4).
2. Map and travel: procedural map, curated start seeds, camera, the 3-city microcosm, route generation, transit, region cards (including the Health policy card's live healthcare and behaviour sliders, 4.2), legend, charts.
3. Interventions and modifiers: lockdown with fatigue, flights, borders, testing, hospital capacity and pressure (6.6), hubs, waning; build the illness arrays slot-aware (6.12) from the start to avoid a second refactor; engine hooks for per-region compliance and live capacity changes; per-band death and hospital rules with the `ageBand` array; the severe-protection rule and the Vaccine version picker; lesson tests 2 to 6, 10 (moved from 1b, since it needs travel and illness timing), 12, 13, 14, 15 and 17.
4. Experimental mode: zoom out, add, remove and resize populations (city or rural, size, density), suggested sites and Auto-fill, route regeneration, real-world numbers (fetch-data script, country picker, CSV import, country health presets including age mix, and "Similar to"); lesson test 7.
3b. Two diseases at once (6.12): per-slot arrays in use, shared pressure, shapes and legend; lesson test 18.
5. Impact panel (including `HarmComparison` with vaccine harm, disease harm, the counterfactual worker and baseline deaths, 6.13), About page with full citations, polish, deploy.

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
- Hospital capacity comes from real beds per 1,000 people and normal occupancy, and overload counts only cases that need a bed (7 Oct).
- Every behaviour and healthcare number is a per-population slider starting from a real-world preset, with a "Similar to" country label (Alex, 7 Oct).
- Populations have an age mix (0-14, 15-64, 65+) that changes death and hospital risk per disease; mixing is the same at all ages (Alex chose to model age now, 7 Oct).
- Vaccines protect in two parts, against infection (all-or-nothing) and against severe illness for breakthrough cases, and diseases can list vaccine versions such as original vs updated COVID-19 vaccines (7 Oct). This replaces "partly vaccinated never die".
- Hospital strain is shown as fixed capacity plus a moving pressure gauge (Coping / Under pressure / Overwhelmed), with a sourced death curve instead of a flat 3x (7 Oct).
- Up to two diseases can circulate at once, coupled only through movement, shared hospital pressure and sourced co-infection effects (7 Oct).
- Vaccine side effects are calculated and shown next to disease harm, including a no-vaccination comparison run (7 Oct).
