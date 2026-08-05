import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { BATTLEFIELD } from "../../data/battlefield.js";
import { Components, Events, Resources } from "../shared/definitions.js";
import { spawnFromArchetype } from "../shared/entity-factory.js";

export function canDeployAt(world, x, z) {
  const raid = world.getResource(Resources.RaidState);
  const deployment = world.getResource(Resources.DeploymentState);
  if (!["deploy", "active"].includes(raid.phase)) return false;
  if (deployment.remaining <= 0) return false;

  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge < BATTLEFIELD.deployMin || edge > BATTLEFIELD.deployMax) return false;

  for (const entity of world.query(Components.Troop, Components.Position, Components.Health)) {
    const position = world.getComponent(entity, Components.Position);
    if (Math.hypot(position.x - x, position.z - z) < 0.9) return false;
  }
  return true;
}

function deploymentSystem(world) {
  const commands = world.getResource(Resources.CommandQueue);
  if (!commands.deploy.length) return;

  let deployment = world.getResource(Resources.DeploymentState);
  for (const request of commands.deploy) {
    const x = Math.round(Number(request.x) * 2) / 2;
    const z = Math.round(Number(request.z) * 2) / 2;

    if (!canDeployAt(world, x, z)) {
      deployment = { ...deployment, rejected: deployment.rejected + 1 };
      world.emit(Events.DeploymentRejected, { x, z, reason: "invalid-deployment-cell" });
      continue;
    }

    const serial = deployment.serial + 1;
    const id = `player-delver-${String(serial).padStart(2, "0")}`;
    spawnFromArchetype(world, {
      id,
      archetype: deployment.selectedArchetype,
      position: [x, z],
      serial
    });
    deployment = {
      ...deployment,
      remaining: deployment.remaining - 1,
      serial,
      accepted: deployment.accepted + 1
    };
    world.setResource(Resources.DeploymentState, deployment);
    world.emit(Events.DeploymentAccepted, { id, x, z, serial });
  }

  world.setResource(Resources.DeploymentState, deployment);
  world.setResource(Resources.CommandQueue, {
    ...commands,
    deploy: []
  });
}

export function createDeploymentKit() {
  return defineDomainServiceKit({
    id: "battle-clash-edge-deployment-kit",
    domain: "battle-clash-deployment",
    domainPath: "n:game:battle-clash:deployment",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashDeployment",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:deployment"],
    requires: [
      "n:game:battle-clash",
      "n:game:battle-clash:world",
      "n:interaction:input"
    ],
    services: ["troop-budget", "edge-deployment"],
    systems: [
      {
        phase: "input",
        name: "battleClashDeploymentSystem",
        system: deploymentSystem
      }
    ],
    createApi({ world }) {
      return {
        canDeployAt: (x, z) => canDeployAt(world, x, z),
        getState: () => structuredClone(world.getResource(Resources.DeploymentState))
      };
    },
    metadata: {
      owns: ["troop budget", "deployment perimeter validation", "deployment receipts"],
      doesNotOwn: ["pointer raycasting", "troop movement", "combat"]
    }
  });
}
