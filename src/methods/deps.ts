import type { Dep } from "../types";

type Opts = { required?: boolean; hint?: string };

export const dep = {
  met(id: string, label: string, opts: Opts = {}): Dep {
    return { id, label, status: "met", required: opts.required ?? false };
  },
  unmet(id: string, label: string, opts: Opts = {}): Dep {
    return {
      id,
      label,
      status: "unmet",
      required: opts.required ?? false,
      hint: opts.hint,
    };
  },
  unknown(id: string, label: string, opts: Opts = {}): Dep {
    return { id, label, status: "unknown", required: opts.required ?? false };
  },
};
