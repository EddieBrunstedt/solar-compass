import { For, Show } from "solid-js";
import type { Location, MethodDescriptor } from "../types";
import { METHODS, isMethodAvailable, type MethodId } from "./index";

export function MethodPicker(props: {
  current: MethodId | null;
  location: Location | null;
  onPick: (id: MethodId) => void;
  onClose?: () => void;
}) {
  const dismissable = () => props.onClose !== undefined;

  return (
    <div class="method-picker" role="dialog" aria-label="Choose method">
      <header class="method-picker-header">
        <div>
          <h1 class="method-picker-title">Choose a method</h1>
          <p class="method-picker-sub">
            Different techniques work in different conditions.
          </p>
        </div>
        <Show when={dismissable()}>
          <button
            class="method-picker-close"
            onClick={() => props.onClose?.()}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                fill="none"
              />
            </svg>
          </button>
        </Show>
      </header>

      <div class="method-picker-list">
        <For each={METHODS}>
          {(m) => (
            <MethodCard
              m={m}
              location={props.location}
              current={props.current === m.id}
              onPick={() => props.onPick(m.id)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

function MethodCard(props: {
  m: MethodDescriptor;
  location: Location | null;
  current: boolean;
  onPick: () => void;
}) {
  const deps = () => props.m.computeDeps({ location: props.location });
  const available = () => isMethodAvailable(props.m, props.location);
  const blockingHint = () =>
    deps().find((d) => d.required && d.status !== "met")?.hint;

  return (
    <button
      class="method-card"
      classList={{
        "method-card-current": props.current,
        "method-card-disabled": !available(),
      }}
      disabled={!available()}
      onClick={props.onPick}
    >
      <div class="method-card-icon">{props.m.icon()}</div>
      <div class="method-card-body">
        <div class="method-card-header">
          <span class="method-card-name">{props.m.name}</span>
          <span class="method-card-when">{props.m.when}</span>
        </div>
        <p class="method-card-tagline">{props.m.tagline}</p>
        <div class="method-card-deps">
          <For each={deps()}>
            {(d) => (
              <span class={`dep-chip dep-${d.status}`}>
                <span class="dep-dot" aria-hidden="true" />
                {d.label}
              </span>
            )}
          </For>
        </div>
        <Show when={!available() && blockingHint()}>
          <div class="method-card-hint">{blockingHint()}</div>
        </Show>
      </div>
    </button>
  );
}
