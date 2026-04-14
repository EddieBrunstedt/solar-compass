import { createMemo, createSignal, For, Show } from "solid-js";
import type { MethodCtx, MethodDescriptor } from "../types";
import { dep } from "./deps";
import { sunAltitudeDeg, sunBearingFromNorth } from "./sun";

const MARGIN = 40;
const TOP_OFFSET = 32;
const TICK_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);

function circlePoint(bearingDeg: number, cx: number, cy: number, r: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function SunAzimuthView(props: { ctx: MethodCtx }) {
  const [swap, setSwap] = createSignal(false);

  const loc = () => props.ctx.location();
  const hasLoc = () => loc() !== null;

  const sunBearing = createMemo(() => {
    const l = loc();
    return l ? sunBearingFromNorth(props.ctx.now(), l.lat, l.lon) : 0;
  });
  const sunAltitude = createMemo(() => {
    const l = loc();
    return l ? sunAltitudeDeg(props.ctx.now(), l.lat, l.lon) : 0;
  });
  const otherBearing = createMemo(() =>
    swap() ? (360 - sunBearing()) % 360 : sunBearing(),
  );

  const vp = () => props.ctx.viewport();
  const cx = createMemo(() => vp().w / 2);
  const cy = createMemo(() => vp().h / 2);
  const radius = createMemo(() => Math.min(vp().w, vp().h) / 2 - MARGIN);
  const topPos = createMemo(() =>
    circlePoint(0, cx(), cy(), radius() + TOP_OFFSET),
  );
  const otherPos = createMemo(() =>
    circlePoint(otherBearing(), cx(), cy(), radius()),
  );

  const timeLabel = createMemo(() => {
    const h24 = props.ctx.use24h();
    const opts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };
    if (h24 !== null) opts.hourCycle = h24 ? "h23" : "h12";
    return props.ctx.now().toLocaleTimeString(navigator.language, opts);
  });

  return (
    <div class="method-sun">
      <svg
        class="dial-svg"
        width={vp().w}
        height={vp().h}
        viewBox={`0 0 ${vp().w} ${vp().h}`}
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
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 40 40" class="method-icon-svg" aria-hidden="true">
      <circle cx="20" cy="20" r="7" fill="#ffd36a" />
      <g stroke="#ffd36a" stroke-width="2" stroke-linecap="round">
        <line x1="20" y1="3" x2="20" y2="9" />
        <line x1="20" y1="31" x2="20" y2="37" />
        <line x1="3" y1="20" x2="9" y2="20" />
        <line x1="31" y1="20" x2="37" y2="20" />
        <line x1="7.5" y1="7.5" x2="11" y2="11" />
        <line x1="29" y1="29" x2="32.5" y2="32.5" />
        <line x1="7.5" y1="32.5" x2="11" y2="29" />
        <line x1="29" y1="11" x2="32.5" y2="7.5" />
      </g>
    </svg>
  );
}

const sunAzimuth = {
  id: "sun-azimuth",
  name: "Sun azimuth",
  tagline: "Daytime compass from the sun's position",
  when: "Day",
  icon: () => <SunIcon />,
  computeDeps: ({ location }) => [
    location
      ? dep.met("location", "Location", { required: true })
      : dep.unmet("location", "Location", {
          required: true,
          hint: "Set a location to enable",
        }),
    dep.met("time", "Time", { required: true }),
    dep.unknown("sun-up", "Sun above horizon"),
  ],
  render: (ctx) => <SunAzimuthView ctx={ctx} />,
} satisfies MethodDescriptor;

export default sunAzimuth;
