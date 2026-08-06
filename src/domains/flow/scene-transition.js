import { Events, Resources } from "../shared/definitions.js";

export const SCENE_TRANSITION_PHASES = Object.freeze([
  "stable",
  "exiting",
  "preparing",
  "loading",
  "ready",
  "revealing",
  "failed"
]);

const PHASE_DURATIONS = Object.freeze({
  exiting: 0.18,
  preparing: 0.12,
  loading: 0.12,
  ready: 0.02,
  revealing: 0.36
});

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function id(value, label) {
  const next = String(value ?? "").trim();
  if (!next) throw new TypeError(`${label} requires a non-empty id.`);
  return next;
}

function transitionId(state, request) {
  return id(
    request.transitionId ?? `battle-clash-transition:${Number(state.sequence ?? 0) + 1}:${request.fromSceneId ?? "none"}:${request.toSceneId}`,
    "scene transition"
  );
}

export function createInitialSceneTransitionState() {
  return {
    schema: "battle-clash.scene-transition/1",
    sequence: 0,
    phase: "stable",
    active: false,
    transitionId: null,
    fromSceneId: null,
    toSceneId: null,
    reason: null,
    payload: {},
    elapsed: 0,
    progress: 1,
    ready: true,
    error: null,
    remote: false,
    startupReady: true,
    preparations: []
  };
}

function withSequence(state, patch) {
  return {
    ...state,
    ...clone(patch),
    sequence: Number(state.sequence ?? 0) + 1
  };
}

export function beginSceneTransition(state, request = {}) {
  const current = state ?? createInitialSceneTransitionState();
  const nextId = transitionId(current, request);
  if (current.active && current.transitionId === nextId) {
    return { accepted: true, duplicate: true, state: clone(current) };
  }
  if (current.active) {
    return { accepted: false, reason: "transition-in-progress", state: clone(current) };
  }
  return {
    accepted: true,
    duplicate: false,
    state: withSequence(current, {
      phase: "exiting",
      active: true,
      transitionId: nextId,
      fromSceneId: request.fromSceneId ?? null,
      toSceneId: id(request.toSceneId, "transition destination"),
      reason: request.reason ?? null,
      payload: clone(request.payload ?? {}),
      elapsed: 0,
      progress: 0,
      ready: false,
      error: null,
      remote: Boolean(request.remote),
      startupReady: request.startupReady !== false,
      preparations: clone(request.preparations ?? [])
    })
  };
}

export function markSceneTransitionReady(state, request = {}) {
  const current = state ?? createInitialSceneTransitionState();
  if (!current.active) return { accepted: false, reason: "no-active-transition", state: clone(current) };
  if (request.transitionId && request.transitionId !== current.transitionId) {
    return { accepted: false, reason: "transition-id-mismatch", state: clone(current) };
  }
  const preparations = (current.preparations ?? []).map((preparation) => ({
    ...preparation,
    status: preparation.required === false || request.preparationId == null || request.preparationId === preparation.id
      ? "ready"
      : preparation.status,
    progress: preparation.required === false || request.preparationId == null || request.preparationId === preparation.id
      ? 1
      : preparation.progress
  }));
  const requiredReady = preparations.filter((item) => item.required !== false).every((item) => item.status === "ready");
  return { accepted: true, state: withSequence(current, { ready: requiredReady, preparations }) };
}

export function failSceneTransition(state, error = {}) {
  const current = state ?? createInitialSceneTransitionState();
  if (!current.active) return { accepted: false, reason: "no-active-transition", state: clone(current) };
  return {
    accepted: true,
    state: withSequence(current, {
      phase: "failed",
      active: false,
      error: clone(error),
      ready: false,
      progress: 0
    })
  };
}

function phaseProgress(phase, elapsed, ready) {
  if (phase === "stable") return 1;
  if (phase === "failed") return 0;
  if (phase === "loading" && !ready) return 0.42;
  const duration = PHASE_DURATIONS[phase] ?? 0.1;
  return Math.min(1, Math.max(0, elapsed / duration));
}

export function advanceSceneTransition(state, deltaSeconds, options = {}) {
  const current = state ?? createInitialSceneTransitionState();
  if (!current.active) return { changed: false, state: clone(current) };
  const delta = Math.max(0, Number(deltaSeconds) || 0);
  let phase = current.phase;
  let elapsed = Number(current.elapsed ?? 0) + delta;
  let ready = Boolean(current.ready || options.ready);
  let active = true;
  let error = null;

  if (phase === "exiting" && elapsed >= PHASE_DURATIONS.exiting) {
    phase = "preparing";
    elapsed = 0;
  }
  if (phase === "preparing" && elapsed >= PHASE_DURATIONS.preparing) {
    phase = "loading";
    elapsed = 0;
  }
  if (phase === "loading" && ready && elapsed >= PHASE_DURATIONS.loading) {
    phase = "ready";
    elapsed = 0;
  }
  if (phase === "ready" && elapsed >= PHASE_DURATIONS.ready) {
    phase = "revealing";
    elapsed = 0;
  }
  if (phase === "loading" && elapsed >= Math.max(1, Number(options.timeoutSeconds ?? 8)) && !ready) {
    phase = "failed";
    active = false;
    error = { code: "scene-readiness-timeout", message: "Scene preparation timed out." };
  }
  if (phase === "revealing" && elapsed >= PHASE_DURATIONS.revealing) {
    phase = "stable";
    elapsed = 0;
    active = false;
  }

  const next = withSequence(current, {
    phase,
    active,
    elapsed,
    ready,
    error,
    progress: phaseProgress(phase, elapsed, ready)
  });
  return { changed: JSON.stringify(next) !== JSON.stringify(current), state: next };
}

export function installSceneTransitionState(world) {
  if (!world.hasResource(Resources.SceneTransitionState)) {
    world.setResource(Resources.SceneTransitionState, createInitialSceneTransitionState());
  }
}

export function publishSceneTransition(world, next) {
  world.setResource(Resources.SceneTransitionState, clone(next));
  world.emit(Events.SceneTransitionChanged, clone(next));
  return clone(next);
}

export function sceneTransitionSystem(world) {
  const current = world.getResource(Resources.SceneTransitionState);
  if (!current?.active) return;
  const result = advanceSceneTransition(current, world.__nexusClock?.delta ?? 0);
  if (result.changed) publishSceneTransition(world, result.state);
}
