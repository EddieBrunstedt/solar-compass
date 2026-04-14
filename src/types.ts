import type { Accessor, JSX } from "solid-js";

export type LocationSource = "gps" | "manual";

export type Location = {
  lat: number;
  lon: number;
  source: LocationSource;
  name?: string;
  fixedAt: number;
};

export type Viewport = { w: number; h: number };

export type MethodCtx = {
  location: Accessor<Location | null>;
  now: Accessor<Date>;
  viewport: Accessor<Viewport>;
  use24h: Accessor<boolean | null>;
  openLocationPicker: () => void;
  openMethodPicker: () => void;
};

export type DepStatus = "met" | "unmet" | "unknown";

export type Dep = {
  id: string;
  label: string;
  required: boolean;
  status: DepStatus;
  hint?: string;
};

export type MethodDescriptor = {
  id: string;
  name: string;
  tagline: string;
  when: string;
  icon: () => JSX.Element;
  computeDeps: (state: { location: Location | null }) => Dep[];
  render: (ctx: MethodCtx) => JSX.Element;
};
