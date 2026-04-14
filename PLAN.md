# Solar Compass — Plan

The app's premise: find true north with whatever the sky, the clock, and your memory of basic astronomy give you, even when GPS and magnetometer are broken. Everything here follows from that premise.

## Guiding principles

- **Graceful degradation over precision.** A rough bearing you can actually get is worth more than a precise one you can't. Prefer methods that work with fewer inputs; fall back to more demanding ones when conditions allow.
- **Honesty about dependencies.** The picker shows what each method needs. The user should never be surprised about what broke.
- **Instruction, not automation.** We are not a magnetometer substitute that silently points at north. For most methods we teach the technique visually; the user does the last step (looking at the real sky) themselves. This is robust and educational — lean into it.
- **No network in the critical path.** Everything except place-name search runs locally.

## Near-term method roadmap

Ordered by value × effort. Each new method is one file under `src/methods/` plus one line in `methods/index.tsx`.

### 1. Southern Cross (Crux) — night, southern hemisphere

The Polaris counterpart. Currently users south of the equator see a Polaris card with a "not visible here" warning and no alternative. Adding Crux makes the app globally useful at night.

- **Deps**: `clear-sky` (unknown), `s-hemisphere` (derived from location or unknown).
- **Scene**: same aesthetic language as Polaris — real star positions, pointer from the long axis of Crux extended ~4.5× to the south celestial pole, drop to horizon → "S". Plus the pointer-cross trick using Crux + the α/β Centauri line (redundancy helps in practice).
- **Estimate**: half-day. The Polaris file is a clean template.

### 2. Moon azimuth — night, location known

For nights when the moon is up. Same math shape as the sun (SunCalc exposes moon position too).

- **Deps**: `location` (required), `time` (always met), `moon-up` (unknown — we could compute this and downgrade the card from "available" when the moon is below the horizon, but leave that to a later pass).
- **Scene**: reuse the sun dial, swap the sun glyph for a moon glyph. Small moon-phase indicator would be a nice touch.
- **Estimate**: half-day. Mostly factoring out the dial into a shared `AzimuthDial` component that `sun-azimuth` and `moon-azimuth` both consume — see "Shared primitives" below.

### 3. Crescent-moon horns — night, no location, no time

A rough-and-ready method. Draw a line through the tips of the crescent, extend to the horizon: that point is roughly south in the N hemisphere (north in S). Works when no other method does — no GPS, no clock, just "there's a crescent moon up there."

- **Deps**: `clear-sky` (unknown), `crescent-moon-visible` (unknown — we *could* compute phase from time to auto-disable at full/new moon, but the method's whole point is resilience, so we let the user judge).
- **Scene**: illustration of crescent + horn line → horizon, with a small "south in N hemisphere / north in S hemisphere" annotation. If location is known we pick the right one automatically.
- **Estimate**: half-day.

### 4. Orion's belt — night, limited seasons

Rises near due east, sets near due west. Rough but memorable. Most valuable because it's a backup when Polaris is obscured.

- **Deps**: `clear-sky`, `time` (optional — the phrasing differs for rising vs setting).
- **Scene**: Orion constellation with east/west horizon markers, small note about when the belt is most useful (evening in winter N hemisphere, summer S hemisphere).
- **Estimate**: half-day.

### 5. Any-bright-star azimuth — night, location known, advanced

For when the moon is down and the user wants better-than-Polaris precision (e.g. at low-latitude N where Polaris is near the horizon). Computes azimuth of Sirius / Vega / Arcturus / Altair / Capella from location + time. Same UI shape as sun/moon azimuth.

- **Deps**: `location` (required), `time` (always met), `star-above-horizon` (computed per-star — we pick the best visible bright star automatically).
- **Scene**: azimuth dial with a star glyph + its name.
- **Estimate**: one full day — needs a small RA/Dec→azimuth implementation. `astronomy-engine` is a clean dep if we want to avoid hand-rolling.

Explicitly skipped: shadow-tip / analog-watch methods. They're charming but require a physical stick or watch face the app can't produce; belongs on a "techniques" explainer, not as a first-class method.

## Shared primitives (refactor before the 3rd method)

Once there are 3+ methods in the registry, the duplication will become real. Plan:

- **`AzimuthDial` component** in `src/methods/shared/`. Extracts the dial/markers/footer from `sun-azimuth.tsx`. Props: current bearing, target label + glyph, altitude-or-null, readout copy. Consumed by `sun-azimuth`, `moon-azimuth`, `bright-star`.
- **`StarScene` component** in `src/methods/shared/`. The indigo sky + seeded background stars + horizon + "N/S" marker. Consumed by `polaris`, `southern-cross`, `orion`, `crescent-moon`.
- **`seededStars(count, seed, exclusions)`** helper extracted to `shared/stars.ts`.

Do the extraction lazily — when adding the third consumer, not the second. Don't design for hypothetical reuse.

## UX items worth a pass

- **Smart default on first launch.** Instead of always showing the picker, pre-select a method based on `sunAltitude(now, location) > 0` (sun) vs `< -6°` (night method available for this hemisphere). Picker still opens on first launch so the user sees what's there, but the pre-highlighted card matches the current sky. Low cost, high "it just works" payoff.
- **"Face this way" confirmation step.** All instructional methods (Polaris, Crux, Orion, crescent) currently end at "you've identified north in the sky." The user still has to translate that to "my phone is pointing this way." Consider an optional follow-up screen: a simple arrow + "rotate until the arrow points at the star you found" — with no actual sensor input, just a self-calibration aid.
- **Method-card availability badge.** When the sun is below the horizon, the sun-azimuth card's `sun-up` dep currently stays `unknown`. We can compute it and show `unmet` (with a subtle "sun is below horizon" hint) — same for moon/bright-star. This makes the picker genuinely diagnostic.
- **Location picker copy.** Right now if GPS is off it says "No location / tap to set." We could surface the last-used location's freshness more prominently (the "2h ago" secondary line is easy to miss). Low priority.
- **Animation pass on Polaris.** The pointer line animates in on mount. It should re-play when navigating *to* Polaris from the picker (currently only on first mount of the component tree). Requires a small key reset or explicit trigger.

## Infrastructure

- **Tests.** No test infra exists. Worth adding once we have the `AzimuthDial` extraction — a pure function like `sunBearingFromNorth` plus the dep-computation functions are the obvious first targets (Vitest + fast-check would be idiomatic for SolidJS). Skip until then; there's little to test in the current scene components.
- **Typecheck in CI-ish loop.** `pnpm tsc --noEmit` currently run manually. A pre-commit hook or a single `pnpm check` script that runs `tsc --noEmit && vite build` would be worth it.
- **Offline geocoding.** The place search is the only network dep. For a "works when everything is broken" app, bundling a tiny offline gazetteer (e.g. ~10k largest cities, ~200 KB gzipped) as a fallback when the network is unreachable would be on-brand. Not urgent — the manual coords entry is always a backstop — but a natural fit.
- **Accessibility audit.** The picker cards are `<button>`s, dep chips aren't keyboard-reachable but don't need to be. The Polaris SVG has no alt text / description. Worth a proper pass once the roadmap above is landed.

## Non-goals (to stay honest)

- We are not going to implement a magnetometer-based live compass. The premise is "works when the magnetometer doesn't."
- We are not going to ship auto-method-switching. The user is in charge of which technique matches their conditions — the app's job is to make that choice informed and effortless, not to guess.
- We are not going to pretty up the instruction scenes into a general astronomy-teaching app. Every pixel should serve the "find north" task.

## Open questions

1. **Precision goalposts.** What's "good enough" for the sun/moon/star azimuth methods? Our current readout shows integer degrees. For navigation on foot that's fine; for sailing it isn't. Should we ever surface "±3°" or similar, and if so, based on what (location accuracy, time accuracy, user's ability to read a dial)?
2. **Hemisphere inference when location is unknown.** Several methods depend on N vs S hemisphere. If location is unset we show "unknown." Is there a light-weight user override ("I'm in the northern hemisphere") worth adding, or does that duplicate the location picker?
3. **Calibration-by-sun trick.** A daytime ritual: use the sun method to find north, then note the bearing to a visible landmark. At night, that landmark is still there — you have a ready-made compass even if the sky clouds over. Is this worth productizing (a "remember this landmark" feature) or does it belong in a one-paragraph tips screen?

Revisit this doc whenever a method lands or a UX pass closes — the roadmap is a living list, not a contract.
