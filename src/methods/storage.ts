import { isValidMethodId, type MethodId } from "./index";

const METHOD_KEY = "solar-compass:method";

export function loadMethodId(): MethodId | null {
  try {
    const raw = localStorage.getItem(METHOD_KEY);
    if (raw && isValidMethodId(raw)) return raw;
  } catch {}
  return null;
}

export function saveMethodId(id: MethodId) {
  try {
    localStorage.setItem(METHOD_KEY, id);
  } catch {}
}
