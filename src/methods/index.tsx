import type { Location, MethodDescriptor } from "../types";
import sunAzimuth from "./sun-azimuth";
import polaris from "./polaris";

export const METHODS = [sunAzimuth, polaris];

export type MethodId = (typeof METHODS)[number]["id"];

export function getMethod(id: string): MethodDescriptor | undefined {
  return METHODS.find((m) => m.id === id);
}

export function isValidMethodId(id: string): id is MethodId {
  return METHODS.some((m) => m.id === id);
}

export function isMethodAvailable(
  m: MethodDescriptor,
  location: Location | null,
): boolean {
  return m
    .computeDeps({ location })
    .every((d) => !d.required || d.status === "met");
}
