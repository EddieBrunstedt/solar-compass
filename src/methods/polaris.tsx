import { createMemo, For, Show } from "solid-js";
import type { MethodCtx, MethodDescriptor } from "../types";
import { dep } from "./deps";

type Star = { x: number; y: number; r: number; o: number };

function seededBackgroundStars(count: number, seed: number): Star[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const stars: Star[] = [];
  const exclusions = [
    { x: 240, y: 140, r: 55 },
    { x: 150, y: 395, r: 140 },
    { x: 240, y: 700, r: 70 },
  ];
  let attempts = 0;
  while (stars.length < count && attempts < count * 20) {
    attempts++;
    const x = rand() * 360;
    const y = rand() * 680;
    if (exclusions.some((e) => Math.hypot(x - e.x, y - e.y) < e.r)) continue;
    stars.push({
      x,
      y,
      r: 0.35 + rand() * 0.9,
      o: 0.25 + rand() * 0.55,
    });
  }
  return stars;
}

// Coordinates derived from J2000 RA/Dec with a flat projection
// (x = -RA·cos(mean_dec), y = -Dec), then scaled and translated into
// our viewBox. Keeps Merak and Dubhe near-vertical so the pointer line
// actually points up to Polaris, as in the sky.
const DIPPER = [
  { id: "alkaid",  x: 30,  y: 455, r: 3.2, label: "Alkaid"  },
  { id: "mizar",   x: 60,  y: 403, r: 3.0, label: "Mizar"   },
  { id: "alioth",  x: 100, y: 394, r: 3.5, label: "Alioth"  },
  { id: "megrez",  x: 152, y: 384, r: 2.1, label: "Megrez"  },
  { id: "dubhe",   x: 248, y: 340, r: 3.5, label: "Dubhe"   },
  { id: "merak",   x: 250, y: 390, r: 3.0, label: "Merak"   },
  { id: "phecda",  x: 181, y: 415, r: 2.8, label: "Phecda"  },
] as const;

const BY = Object.fromEntries(DIPPER.map((s) => [s.id, s])) as Record<
  (typeof DIPPER)[number]["id"],
  (typeof DIPPER)[number]
>;

// Handle: Alkaid → Mizar → Alioth → Megrez
// Bowl:   Megrez → Dubhe → Merak → Phecda → Megrez
const CONSTELLATION_PATH = [
  BY.alkaid,
  BY.mizar,
  BY.alioth,
  BY.megrez,
  BY.dubhe,
  BY.merak,
  BY.phecda,
  BY.megrez,
]
  .map((s, i) => `${i === 0 ? "M" : "L"} ${s.x} ${s.y}`)
  .join(" ");

// Polaris sits on the pointer line, ~4× the Merak→Dubhe distance beyond
// Dubhe (reality is ~5×; we shorten slightly so it fits the frame).
const POINTER_K = 4;
const POLARIS = {
  x: BY.dubhe.x + POINTER_K * (BY.dubhe.x - BY.merak.x),
  y: BY.dubhe.y + POINTER_K * (BY.dubhe.y - BY.merak.y),
};

const HORIZON_Y = 705;
const N_Y = 740;
const BG_STARS = seededBackgroundStars(80, 0x5ea501a);

function PolarisView(props: { ctx: MethodCtx }) {
  const southernHemisphere = createMemo(() => {
    const l = props.ctx.location();
    return l !== null && l.lat < 0;
  });

  return (
    <div class="method-polaris">
      <svg
        class="polaris-sky"
        viewBox="0 0 360 780"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="polaris-bg" cx="50%" cy="28%" r="85%">
            <stop offset="0%" stop-color="#1a2447" />
            <stop offset="60%" stop-color="#0b1226" />
            <stop offset="100%" stop-color="#04060f" />
          </radialGradient>
          <radialGradient id="polaris-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fef6d8" stop-opacity="0.9" />
            <stop offset="45%" stop-color="#c9d8ff" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#c9d8ff" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="horizon-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stop-color="rgba(200,215,255,0)" />
            <stop offset="50%" stop-color="rgba(200,215,255,0.5)" />
            <stop offset="100%" stop-color="rgba(200,215,255,0)" />
          </linearGradient>
          <linearGradient id="ground-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(4,6,15,0)" />
            <stop offset="100%" stop-color="rgba(4,6,15,0.95)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="360" height="780" fill="url(#polaris-bg)" />

        <g class="polaris-bg-stars">
          <For each={BG_STARS}>
            {(s) => (
              <circle
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill="#e8ecff"
                opacity={s.o}
              />
            )}
          </For>
        </g>

        <line
          class="polaris-pointer"
          x1={BY.merak.x}
          y1={BY.merak.y}
          x2={POLARIS.x}
          y2={POLARIS.y}
          stroke="rgba(200,215,255,0.55)"
          stroke-width="1.1"
          stroke-dasharray="4 5"
          stroke-linecap="round"
        />

        <path
          d={CONSTELLATION_PATH}
          fill="none"
          stroke="rgba(230,235,255,0.4)"
          stroke-width="1.1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <g class="polaris-dipper-stars">
          <For each={DIPPER}>
            {(s) => (
              <>
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={s.r + 2.5}
                  fill="#e8ecff"
                  opacity="0.15"
                />
                <circle cx={s.x} cy={s.y} r={s.r} fill="#fafcff" />
              </>
            )}
          </For>
        </g>

        <text
          class="polaris-caption"
          x={(BY.alioth.x + BY.phecda.x) / 2}
          y={BY.phecda.y + 35}
          text-anchor="middle"
        >
          The Big Dipper
        </text>

        <g class="polaris-star">
          <circle cx={POLARIS.x} cy={POLARIS.y} r="36" fill="url(#polaris-glow)" />
          <circle cx={POLARIS.x} cy={POLARIS.y} r="4.4" fill="#fffaea" />
        </g>
        <text
          class="polaris-label"
          x={POLARIS.x - 14}
          y={POLARIS.y + 4}
          text-anchor="end"
        >
          Polaris
        </text>
        <text
          class="polaris-sublabel"
          x={POLARIS.x - 14}
          y={POLARIS.y + 20}
          text-anchor="end"
        >
          North Star
        </text>

        <rect
          x="0"
          y={HORIZON_Y - 30}
          width="360"
          height="110"
          fill="url(#ground-grad)"
        />
        <line
          x1="20"
          x2="340"
          y1={HORIZON_Y}
          y2={HORIZON_Y}
          stroke="url(#horizon-grad)"
          stroke-width="1.2"
        />

        <line
          class="polaris-drop"
          x1={POLARIS.x}
          y1={POLARIS.y + 12}
          x2={POLARIS.x}
          y2={HORIZON_Y - 6}
          stroke="rgba(255,250,234,0.28)"
          stroke-width="1"
          stroke-dasharray="2 7"
        />
        <polygon
          points={`${POLARIS.x - 5},${HORIZON_Y - 10} ${POLARIS.x + 5},${HORIZON_Y - 10} ${POLARIS.x},${HORIZON_Y - 2}`}
          fill="rgba(255,250,234,0.7)"
        />
        <text
          class="polaris-north"
          x={POLARIS.x}
          y={N_Y}
          text-anchor="middle"
        >
          N
        </text>
      </svg>

      <div class="polaris-overlay">
        <Show when={southernHemisphere()}>
          <div class="polaris-warning">
            You're in the southern hemisphere — Polaris isn't visible from here.
          </div>
        </Show>
        <div class="polaris-instructions">
          <p>
            Find the Big Dipper. Draw a line through the two stars at the end of
            its bowl — <em>Merak</em> and <em>Dubhe</em> — and extend it about
            five times their distance. That star is <strong>Polaris</strong>.
            Face it, and you face true north.
          </p>
        </div>
      </div>
    </div>
  );
}

function PolarisIcon() {
  return (
    <svg viewBox="0 0 40 40" class="method-icon-svg" aria-hidden="true">
      <circle cx="10" cy="32" r="1.3" fill="#bfd0ff" />
      <circle cx="16" cy="30" r="1.1" fill="#bfd0ff" />
      <circle cx="22" cy="29" r="1.3" fill="#bfd0ff" />
      <circle cx="28" cy="27" r="1.1" fill="#bfd0ff" />
      <circle cx="32" cy="31" r="1.2" fill="#bfd0ff" />
      <path
        d="M 10 32 L 16 30 L 22 29 L 28 27 L 32 31"
        fill="none"
        stroke="rgba(191,208,255,0.5)"
        stroke-width="0.8"
      />
      <circle cx="24" cy="9" r="3" fill="url(#m-polaris-glow)" opacity="0.8" />
      <circle cx="24" cy="9" r="1.5" fill="#fffaea" />
      <line
        x1="28"
        y1="27"
        x2="24"
        y2="11"
        stroke="rgba(255,250,234,0.5)"
        stroke-width="0.7"
        stroke-dasharray="1.5 2"
      />
      <defs>
        <radialGradient id="m-polaris-glow">
          <stop offset="0%" stop-color="#fffaea" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#fffaea" stop-opacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

const polaris = {
  id: "polaris",
  name: "Polaris via Big Dipper",
  tagline: "Night-time north from the North Star",
  when: "Night · Northern hemisphere",
  icon: () => <PolarisIcon />,
  computeDeps: ({ location }) => {
    const hemisphere =
      location === null
        ? dep.unknown("n-hemisphere", "Northern hemisphere")
        : location.lat >= 0
          ? dep.met("n-hemisphere", "Northern hemisphere")
          : dep.unmet("n-hemisphere", "Northern hemisphere", {
              hint: "Polaris isn't visible south of the equator",
            });
    return [dep.unknown("clear-sky", "Clear night sky"), hemisphere];
  },
  render: (ctx) => <PolarisView ctx={ctx} />,
} satisfies MethodDescriptor;

export default polaris;
