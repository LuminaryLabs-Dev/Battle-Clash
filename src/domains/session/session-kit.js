import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Events, Resources } from "../shared/definitions.js";
import { createDefaultSession } from "../shared/entity-factory.js";

const SESSION_ROLES = new Set(["solo", "attacker", "defender"]);

function normalizeSession(current, patch = {}) {
  const next = {
    ...createDefaultSession(),
    ...current,
    ...structuredClone(patch)
  };
  if (!SESSION_ROLES.has(next.role)) {
    throw new TypeError(`Unsupported Battle Clash room role: ${next.role}`);
  }
  return next;
}

export function createSessionKit() {
  return defineDomainServiceKit({
    id: "battle-clash-session-kit",
    domain: "battle-clash-session",
    domainPath: "n:game:battle-clash:session",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashSession",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:session"],
    requires: ["n:game:battle-clash", "n:network"],
    services: [
      "attack-defend-room",
      "authority-read-model",
      "connection-state",
      "message-envelope-contract"
    ],
    createApi({ engine, world }) {
      const getState = () =>
        structuredClone(world.getResource(Resources.SessionState));

      return {
        getState,
        update(patch = {}) {
          const next = normalizeSession(getState(), patch);
          world.setResource(Resources.SessionState, next);
          engine.n.network.update(
            {
              session: next,
              authority: {
                model: "defender-host",
                localRole: next.role,
                source: next.authority
              }
            },
            "updated"
          );
          world.emit(Events.SessionChanged, structuredClone(next));
          return getState();
        }
      };
    },
    metadata: {
      owns: [
        "attack and defend room state",
        "local authority read model",
        "game message envelope contract"
      ],
      doesNotOwn: [
        "PeerJS SDK lifecycle",
        "signaling infrastructure",
        "TURN infrastructure",
        "combat outcomes"
      ]
    }
  });
}
