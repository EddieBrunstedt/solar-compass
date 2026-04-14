import { createSignal, onCleanup, onMount, createMemo, For } from "solid-js";
import SunCalc from "suncalc";
import "./App.css";

const STOCKHOLM = { lat: 59.3293, lon: 18.0686 };
const MARGIN = 40;
const TOP_OFFSET = 32;
const TICK_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);

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

function App() {
  const [now, setNow] = createSignal(new Date());
  const [swap, setSwap] = createSignal(false);
  const [viewport, setViewport] = createSignal({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  onMount(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    onCleanup(() => {
      clearInterval(tick);
      window.removeEventListener("resize", onResize);
    });
  });

  const sunBearing = createMemo(() =>
    sunBearingFromNorth(now(), STOCKHOLM.lat, STOCKHOLM.lon),
  );
  const sunAltitude = createMemo(() =>
    sunAltitudeDeg(now(), STOCKHOLM.lat, STOCKHOLM.lon),
  );
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

  const timeLabel = createMemo(() =>
    now().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );

  return (
    <main class="app">
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
        class={`marker ${swap() ? "marker-sun" : "marker-n"}`}
        style={{ left: `${topPos().x}px`, top: `${topPos().y}px` }}
      >
        {swap() ? "☀️" : "N"}
      </div>
      <div
        class={`marker ${swap() ? "marker-n" : "marker-sun"}`}
        style={{ left: `${otherPos().x}px`, top: `${otherPos().y}px` }}
      >
        {swap() ? "N" : "☀️"}
      </div>

      <div class="footer">
        <div class="readout">
          <div class="azimuth">
            <span class="num">{sunBearing().toFixed(0)}</span>
            <span class="deg">°</span>
          </div>
          <div class="sub">Sun bearing from north</div>
        </div>
        <div class="meta">
          <span>Stockholm</span>
          <span class="dot">·</span>
          <span>{timeLabel()}</span>
          <span class="dot">·</span>
          <span>
            {sunAltitude() < 0
              ? "below horizon"
              : `alt ${sunAltitude().toFixed(0)}°`}
          </span>
        </div>
        <button class="swap" onClick={() => setSwap((s) => !s)}>
          {swap() ? "Show North at top" : "Show Sun at top"}
        </button>
      </div>
    </main>
  );
}

export default App;
