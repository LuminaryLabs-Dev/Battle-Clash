import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Events, Resources } from "../shared/definitions.js";

const PLAYER_SCHEMA = "battle-clash.player-domain/1";
const clone = (value) => structuredClone(value);

function initialState() {
  return { schema: PLAYER_SCHEMA, agentId: "battleclash-player", mode: "disabled", status: "idle", episodeId: null, step: 0, goal: null, lastObservationId: null, lastDecisionId: null, lastOutcomeId: null };
}

export function createPlayerKit() {
  return defineDomainServiceKit({
    id: "battle-clash-player-domain-kit",
    domain: "battle-clash-player",
    domainPath: "n:game:battle-clash:player",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashPlayer",
    stability: "experimental",
    version: "0.1.0",
    requires: ["n:game:battle-clash", "n:core-data", "n:core-input"],
    services: ["observation", "memory", "decision", "episode", "learning"],
    createApi({ world }) {
      for (const [resource, value] of [
        [Resources.PlayerState, initialState()],
        [Resources.PlayerObservation, null],
        [Resources.PlayerMemory, { schema: "battle-clash.player-memory/1", retrieved: [], promoted: [] }],
        [Resources.PlayerDecision, null],
        [Resources.PlayerEpisode, null],
        [Resources.PlayerLearningSignal, null]
      ]) if (world.getResource(resource) === undefined) world.setResource(resource, value);

      const getState = () => clone(world.getResource(Resources.PlayerState));
      const update = (patch) => { const next = { ...getState(), ...clone(patch) }; world.setResource(Resources.PlayerState, next); return clone(next); };
      return {
        getState,
        getObservation: () => clone(world.getResource(Resources.PlayerObservation)),
        getMemory: () => clone(world.getResource(Resources.PlayerMemory)),
        getDecision: () => clone(world.getResource(Resources.PlayerDecision)),
        getEpisode: () => clone(world.getResource(Resources.PlayerEpisode)),
        startEpisode({ episodeId, goal, mode = "ecs" } = {}) {
          const next = update({ status: "observing", mode, episodeId: String(episodeId ?? "episode"), goal: String(goal ?? ""), step: 0 });
          world.setResource(Resources.PlayerEpisode, { schema: "battle-clash.player-episode/1", episodeId: next.episodeId, goal: next.goal, status: "running", step: 0 });
          world.emit(Events.PlayerEpisodeStarted, clone(next));
          return next;
        },
        recordObservation(observation = {}) {
          const next = { schema: "battle-clash.observation/1", ...clone(observation) };
          world.setResource(Resources.PlayerObservation, next);
          const state = update({ status: "deciding", step: getState().step + 1, lastObservationId: next.observationId ?? null });
          world.emit(Events.PlayerObserved, clone(next));
          return { observation: clone(next), state };
        },
        retrieveMemory(memories = []) {
          const next = { ...(world.getResource(Resources.PlayerMemory) ?? {}), schema: "battle-clash.player-memory/1", retrieved: clone(memories) };
          world.setResource(Resources.PlayerMemory, next);
          world.emit(Events.PlayerMemoryRetrieved, clone(memories));
          return clone(next);
        },
        recordDecision(decision = {}) {
          const next = { schema: "battle-clash.player-decision/1", ...clone(decision) };
          world.setResource(Resources.PlayerDecision, next);
          update({ status: "executing", lastDecisionId: next.decisionId ?? null });
          world.emit(Events.PlayerDecisionMade, clone(next));
          return clone(next);
        },
        recordActionResult({ accepted, action, reason = null } = {}) {
          const event = { action: clone(action), reason };
          world.emit(accepted ? Events.PlayerActionAccepted : Events.PlayerActionRejected, event);
          update({ status: accepted ? "evaluating" : "blocked" });
          return { accepted: Boolean(accepted), ...event };
        },
        recordOutcome(outcome = {}) {
          const next = { schema: "battle-clash.player-learning/1", ...clone(outcome) };
          world.setResource(Resources.PlayerLearningSignal, next);
          update({ status: "observing", lastOutcomeId: next.outcomeId ?? null });
          world.emit(Events.PlayerOutcomeRecorded, clone(next));
          return clone(next);
        },
        completeEpisode(status = "complete", result = null) {
          const nextStatus = status === "complete" ? "complete" : "failed";
          const episode = { ...(world.getResource(Resources.PlayerEpisode) ?? {}), status: nextStatus, result: clone(result) };
          world.setResource(Resources.PlayerEpisode, episode);
          const state = update({ status: nextStatus });
          world.emit(nextStatus === "complete" ? Events.PlayerEpisodeCompleted : Events.PlayerEpisodeFailed, clone(episode));
          return { episode: clone(episode), state };
        },
        promoteSkill(skill) {
          const memory = world.getResource(Resources.PlayerMemory) ?? { schema: "battle-clash.player-memory/1", retrieved: [], promoted: [] };
          const next = { ...memory, promoted: [...(memory.promoted ?? []), clone(skill)] };
          world.setResource(Resources.PlayerMemory, next);
          world.emit(Events.PlayerSkillPromoted, clone(skill));
          return clone(skill);
        }
      };
    },
    metadata: {
      owns: ["player observations", "memory retrieval references", "decisions", "episodes", "learning signals"],
      doesNotOwn: ["combat rules", "world state", "rendering", "browser automation", "PeerJS transport"]
    }
  });
}
