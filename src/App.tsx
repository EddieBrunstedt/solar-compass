import {
  createSignal,
  onCleanup,
  onMount,
  createMemo,
  createEffect,
  For,
  Show,
} from "solid-js";
import SunCalc from "suncalc";
import { invoke } from "@tauri-apps/api/core";
import {
  getCurrentPosition,
  checkPermissions,
  requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import "./App.css";

type LocationSource = "gps" | "manual";
type Location = {
  lat: number;
  lon: number;
  source: LocationSource;
  name?: string;
  fixedAt: number;
};

const STORAGE_KEY = "solar-compass:location";
const MARGIN = 40;
const TOP_OFFSET = 32;
const TICK_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

function sunBearingFromNorth(date: Date, lat: number, lon: number): number {
  const { azimuth } = SunCalc.getPosition(date, lat, lon);
  const deg = (azimuth * 180) / Math.PI + 180;
  return ((deg % 360) + 360) % 360;
}

function sunAltitudeDeg(date: Date, lat: number, lon: number): number {
  return (SunCalc.getPosition(date, lat, lon).altitude * 180) / Math.PI;
}

function circlePoint(bearingDeg: number, cx: number, cy: number, r: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function loadLocation(): Location | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.lat === "number" &&
      typeof parsed?.lon === "number" &&
      (parsed.source === "gps" || parsed.source === "manual")
    ) {
      return parsed as Location;
    }
  } catch {}
  return null;
}

function saveLocation(loc: Location) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch {}
}

function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function formatAgo(fixedAt: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - fixedAt) / 1000));
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

type GeocodeResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

async function searchPlaces(query: string): Promise<GeocodeResult[]> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const data = await res.json();
  return data?.results ?? [];
}

function App() {
  const [now, setNow] = createSignal(new Date());
  const [swap, setSwap] = createSignal(false);
  const [viewport, setViewport] = createSignal({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [location, setLocation] = createSignal<Location | null>(loadLocation());
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [gpsPerm, setGpsPerm] = createSignal<
    "unknown" | "granted" | "denied" | "prompt"
  >("unknown");
  const [gpsFetch, setGpsFetch] = createSignal<"idle" | "fetching" | "error">(
    "idle",
  );
  const [use24h, setUse24h] = createSignal<boolean | null>(null);

  async function refreshPerm(): Promise<
    "granted" | "denied" | "prompt" | "unknown"
  > {
    try {
      const p = await checkPermissions();
      const granted =
        p.location === "granted" || p.coarseLocation === "granted";
      const denied =
        p.location === "denied" && p.coarseLocation === "denied";
      const val = granted ? "granted" : denied ? "denied" : "prompt";
      setGpsPerm(val);
      return val;
    } catch (err) {
      console.error("[gps] checkPermissions failed", err);
      setGpsPerm("unknown");
      return "unknown";
    }
  }

  let gpsInFlight = false;

  async function requestGpsFix() {
    if (gpsInFlight) {
      console.log("[gps] request already in flight; ignoring");
      return;
    }
    gpsInFlight = true;
    try {
      let perm = await refreshPerm();
      console.log("[gps] initial perm:", perm);
      if (perm === "prompt" || perm === "unknown") {
        const requested = await Promise.race([
          requestPermissions(["coarseLocation"]),
          new Promise<null>((resolve) =>
            window.setTimeout(() => resolve(null), 6_000),
          ),
        ]);
        if (requested === null) {
          console.warn("[gps] requestPermissions did not settle; re-checking");
        }
        perm = await refreshPerm();
        console.log("[gps] post-request perm:", perm);
      }
      if (perm !== "granted") {
        return;
      }
      setGpsFetch("fetching");
      const safety = window.setTimeout(() => {
        if (gpsFetch() === "fetching") {
          console.warn("[gps] fetch safety timeout");
          setGpsFetch("error");
        }
      }, 12_000);
      try {
        const pos = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 60_000,
        });
        console.log(
          "[gps] got position",
          pos.coords.latitude,
          pos.coords.longitude,
        );
        const next: Location = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "gps",
          fixedAt: Date.now(),
        };
        setLocation(next);
        saveLocation(next);
        setGpsFetch("idle");
      } catch (err) {
        console.error("[gps] fetch failed", err);
        setGpsFetch("error");
      } finally {
        clearTimeout(safety);
      }
    } finally {
      if (!location()) setPickerOpen(true);
      gpsInFlight = false;
      console.log(
        "[gps] end. perm:",
        gpsPerm(),
        "fetch:",
        gpsFetch(),
      );
    }
  }

  function pickPlace(r: GeocodeResult) {
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    const next: Location = {
      lat: r.latitude,
      lon: r.longitude,
      source: "manual",
      name: label,
      fixedAt: Date.now(),
    };
    setLocation(next);
    saveLocation(next);
    setPickerOpen(false);
  }

  onMount(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    onCleanup(() => {
      clearInterval(tick);
      window.removeEventListener("resize", onResize);
    });
    refreshPerm().then(() => requestGpsFix());
    invoke<boolean>("is_24_hour_format")
      .then((v) => setUse24h(v))
      .catch(() => setUse24h(null));
  });

  const loc = () => location();
  const hasLoc = () => loc() !== null;

  const sunBearing = createMemo(() => {
    const l = loc();
    return l ? sunBearingFromNorth(now(), l.lat, l.lon) : 0;
  });
  const sunAltitude = createMemo(() => {
    const l = loc();
    return l ? sunAltitudeDeg(now(), l.lat, l.lon) : 0;
  });
  const otherBearing = createMemo(() =>
    swap() ? (360 - sunBearing()) % 360 : sunBearing(),
  );

  const cx = createMemo(() => viewport().w / 2);
  const cy = createMemo(() => viewport().h / 2);
  const radius = createMemo(
    () => Math.min(viewport().w, viewport().h) / 2 - MARGIN,
  );
  const topPos = createMemo(() =>
    circlePoint(0, cx(), cy(), radius() + TOP_OFFSET),
  );
  const otherPos = createMemo(() =>
    circlePoint(otherBearing(), cx(), cy(), radius()),
  );

  const timeLabel = createMemo(() => {
    const h24 = use24h();
    const opts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    if (h24 !== null) opts.hourCycle = h24 ? "h23" : "h12";
    return now().toLocaleTimeString(navigator.language, opts);
  });

  const locationPrimary = createMemo(() => {
    const l = loc();
    if (l)
      return l.source === "gps"
        ? formatCoords(l.lat, l.lon)
        : (l.name ?? formatCoords(l.lat, l.lon));
    if (gpsFetch() === "fetching") return "Locating…";
    if (gpsPerm() === "denied") return "Location off";
    if (gpsPerm() === "unknown") return "Checking…";
    return "No location";
  });
  const locationSecondary = createMemo(() => {
    const l = loc();
    if (l) {
      if (l.source === "gps") {
        return gpsFetch() === "fetching"
          ? "GPS · locating…"
          : `GPS · ${formatAgo(l.fixedAt, now().getTime())}`;
      }
      return "manual";
    }
    if (gpsFetch() === "fetching") return "GPS";
    if (gpsPerm() === "denied") return "permission blocked";
    return "tap to set";
  });

  return (
    <main class="app">
      <button
        class="location-pill"
        onClick={() => setPickerOpen(true)}
        aria-label="Change location"
      >
        <span class="location-primary">{locationPrimary()}</span>
        <span class="location-secondary">{locationSecondary()}</span>
      </button>

      <svg
        class="dial-svg"
        width={viewport().w}
        height={viewport().h}
        viewBox={`0 0 ${viewport().w} ${viewport().h}`}
      >
        <circle
          cx={cx()}
          cy={cy()}
          r={radius()}
          fill="none"
          stroke="rgba(246,246,246,0.25)"
          stroke-width="2"
        />
        <For each={TICK_ANGLES}>
          {(angle) => {
            const major = angle % 90 === 0;
            const inner = radius() - (major ? 16 : 8);
            const a = circlePoint(angle, cx(), cy(), inner);
            const b = circlePoint(angle, cx(), cy(), radius());
            return (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={
                  major ? "rgba(246,246,246,0.55)" : "rgba(246,246,246,0.3)"
                }
                stroke-width={major ? 2.5 : 1.5}
                stroke-linecap="round"
              />
            );
          }}
        </For>
        <circle cx={cx()} cy={cy()} r="3" fill="rgba(246,246,246,0.7)" />
      </svg>

      <div
        class={`marker ${swap() && hasLoc() ? "marker-sun" : "marker-n"}`}
        style={{ left: `${topPos().x}px`, top: `${topPos().y}px` }}
      >
        {swap() && hasLoc() ? "☀️" : "N"}
      </div>
      <Show when={hasLoc()}>
        <div
          class={`marker ${swap() ? "marker-n" : "marker-sun"}`}
          style={{ left: `${otherPos().x}px`, top: `${otherPos().y}px` }}
        >
          {swap() ? "N" : "☀️"}
        </div>
      </Show>

      <div class="footer">
        <Show
          when={hasLoc()}
          fallback={
            <div class="readout">
              <div class="azimuth">
                <span class="num">—</span>
              </div>
              <div class="sub">Set a location to see the sun</div>
            </div>
          }
        >
          <div class="readout">
            <div class="azimuth">
              <span class="num">{sunBearing().toFixed(0)}</span>
              <span class="deg">°</span>
            </div>
            <div class="sub">Sun bearing from north</div>
          </div>
        </Show>
        <div class="meta">
          <span>{timeLabel()}</span>
          <Show when={hasLoc()}>
            <span class="dot">·</span>
            <span>
              {sunAltitude() < 0
                ? "below horizon"
                : `alt ${sunAltitude().toFixed(0)}°`}
            </span>
          </Show>
        </div>
        <Show when={hasLoc()}>
          <button class="swap" onClick={() => setSwap((s) => !s)}>
            {swap() ? "Show North at top" : "Show Sun at top"}
          </button>
        </Show>
      </div>

      <Show when={pickerOpen()}>
        <LocationPicker
          gpsPerm={gpsPerm()}
          gpsFetch={gpsFetch()}
          onClose={() => setPickerOpen(false)}
          onUseGps={() => {
            requestGpsFix();
          }}
          onPick={pickPlace}
        />
      </Show>
    </main>
  );
}

function LocationPicker(props: {
  gpsPerm: "unknown" | "granted" | "denied" | "prompt";
  gpsFetch: "idle" | "fetching" | "error";
  onClose: () => void;
  onUseGps: () => void;
  onPick: (r: GeocodeResult) => void;
}) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<GeocodeResult[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);

  let debounceHandle: number | undefined;

  createEffect(() => {
    const q = query().trim();
    if (debounceHandle) {
      clearTimeout(debounceHandle);
      debounceHandle = undefined;
    }
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    debounceHandle = window.setTimeout(async () => {
      try {
        const items = await searchPlaces(q);
        if (query().trim() === q) {
          setResults(items);
        }
      } catch (err) {
        console.error("geocode failed", err);
        setSearchError("Search failed. Check your connection.");
        setResults([]);
      } finally {
        if (query().trim() === q) setSearching(false);
      }
    }, 300);
  });

  onCleanup(() => {
    if (debounceHandle) clearTimeout(debounceHandle);
  });

  const gpsLabel = () => {
    if (props.gpsFetch === "fetching") return "Locating…";
    if (props.gpsPerm === "denied") return "Location permission blocked";
    if (props.gpsFetch === "error") return "GPS failed — try again";
    return "Use my location";
  };

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div
        class="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose location"
      >
        <div class="sheet-handle" />
        <Show when={query().trim().length === 0}>
          <button
            class="sheet-gps"
            onClick={props.onUseGps}
            disabled={
              props.gpsFetch === "fetching" || props.gpsPerm === "denied"
            }
          >
            {gpsLabel()}
          </button>
          <Show when={props.gpsPerm === "denied"}>
            <div class="sheet-hint sheet-gps-hint">
              Enable location for this app in Android Settings → Apps → Solar
              Compass → Permissions.
            </div>
          </Show>
        </Show>
        <input
          class="sheet-input"
          type="search"
          placeholder="Search for a city or place"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
        />
        <div class="sheet-results">
          <Show when={query().trim().length === 0}>
            <div class="sheet-hint">Type 2+ letters to search</div>
          </Show>
          <Show when={query().trim().length === 1}>
            <div class="sheet-hint">Keep typing…</div>
          </Show>
          <Show when={searching()}>
            <div class="sheet-hint">Searching…</div>
          </Show>
          <Show when={!searching() && searchError()}>
            <div class="sheet-hint sheet-error">{searchError()}</div>
          </Show>
          <Show
            when={
              !searching() &&
              !searchError() &&
              query().trim().length >= 2 &&
              results().length === 0
            }
          >
            <div class="sheet-hint">No matches</div>
          </Show>
          <For each={results()}>
            {(r) => (
              <button class="sheet-result" onClick={() => props.onPick(r)}>
                <span class="sheet-result-name">{r.name}</span>
                <span class="sheet-result-meta">
                  {[r.admin1, r.country].filter(Boolean).join(", ")}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

export default App;
