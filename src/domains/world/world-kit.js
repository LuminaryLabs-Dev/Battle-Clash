import {
  createFlatWorldSurface,
  createUniformGridPartition
} from "nexusengine/core-domains/core-world-domain";
import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import {
  BATTLEFIELD,
  WORLD_ID,
  WORLD_SEED
} from "../../data/battlefield.js";
import { seedBattleState } from "../shared/entity-factory.js";

export function createBattleWorldKit(options = {}) {
  return defineDomainServiceKit({
    id: "battle-clash-world-kit",
    domain: "battle-clash-world",
    domainPath: "n:game:battle-clash:world",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashWorld",
    stability: "experimental",
    version: "0.1.0",
    requires: [
      "n:game:battle-clash",
      "n:world",
      "n:core-spatial"
    ],
    services: ["battlefield", "deployment-perimeter"],
    metadata: {
      owns: [
        "authored battlefield definition",
        "deployment perimeter",
        "game entity seeding"
      ],
      doesNotOwn: [
        "world cell lifecycle",
        "renderer meshes",
        "combat outcomes"
      ]
    },
    initWorld({ engine, world }) {
      engine.n.coreWorld.registerWorld({
        id: WORLD_ID,
        seed: WORLD_SEED,
        partition: createUniformGridPartition({
          id: "battle-clash-grid",
          cellSize: BATTLEFIELD.cellSize,
          radius: BATTLEFIELD.cellRadius
        }),
        surface: createFlatWorldSurface({
          id: "battle-clash-flat-surface"
        }),
        providers: []
      });
      engine.n.coreWorld.setFocus(WORLD_ID, {
        position: { x: 0, y: 0, z: 0 }
      });
      engine.n.coreWorld.updateWorld(WORLD_ID);
      seedBattleState(world, {
        progression: options.progression
      });
    },
    createApi({ engine }) {
      return {
        id: WORLD_ID,
        seed: WORLD_SEED,
        getSnapshot() {
          return engine.n.coreWorld.snapshotWorld(WORLD_ID);
        },
        getActiveCells() {
          return engine.n.coreWorld.getActiveCells(WORLD_ID);
        }
      };
    }
  });
}
