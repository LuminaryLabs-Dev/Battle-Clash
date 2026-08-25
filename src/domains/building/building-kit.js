import { defineDomainServiceKit } from "nexusengine/domain-service-kit";
import { Events, Resources } from "../shared/definitions.js";
import {
  demolishBuilding,
  placeBuilding,
  selectBuilding,
  selectBuildingBlueprint,
  selectBuildingPlot,
  upgradeBuilding
} from "./building-state.js";

export function createBuildingKit() {
  return defineDomainServiceKit({
    id: "battle-clash-building-kit",
    domain: "battle-clash-building",
    domainPath: "n:game:battle-clash:building",
    parentDomainPath: "n:game:battle-clash",
    apiName: "battleClashBuilding",
    stability: "experimental",
    version: "0.1.0",
    provides: ["n:game:battle-clash:building"],
    requires: ["n:game:battle-clash", "n:game:battle-clash:world", "n:spatial"],
    services: ["building-selection", "building-placement", "building-upgrades", "building-collision"],
    metadata: {
      owns: ["sanctum building rules", "building costs and bonuses", "building placement collision"],
      doesNotOwn: ["Three.js meshes", "browser pointer input", "Core spatial primitives"]
    },
    initWorld({ world }) {
      const current = world.getResource(Resources.WorldState);
      world.setResource(Resources.BuildingState, structuredClone(current.buildings));
    },
    createApi({ engine }) {
      const apply = (action, event) => {
        const result = action(engine.world.getResource(Resources.WorldState));
        if (!result.accepted) {
          engine.world.emit(Events.BuildingRejected, { reason: result.reason, revision: result.state?.revision ?? 0 });
          return result;
        }
        engine.world.setResource(Resources.WorldState, result.state);
        engine.world.setResource(Resources.BuildingState, structuredClone(result.state.buildings));
        engine.world.setResource(Resources.ArmyState, structuredClone(result.state.army));
        engine.world.setResource(Resources.EconomyState, structuredClone(result.state.economy));
        engine.world.setResource(Resources.SanctumState, structuredClone(result.state.sanctum));
        engine.world.emit(event, structuredClone(result.receipt ?? {
          kind: "selected",
          revision: result.state.revision,
          buildingId: result.state.buildings.selectedBuildingId,
          plotId: result.state.buildings.selectedPlotId,
          blueprintId: result.state.buildings.selectedBlueprintId
        }));
        return { ...result, state: structuredClone(result.state) };
      };
      return {
        getState: () => structuredClone(engine.world.getResource(Resources.BuildingState)),
        selectBlueprint: (blueprintId) => apply((state) => selectBuildingBlueprint(state, blueprintId), Events.BuildingSelected),
        selectPlot: (plotId) => apply((state) => selectBuildingPlot(state, plotId), Events.BuildingSelected),
        selectBuilding: (buildingId) => apply((state) => selectBuilding(state, buildingId), Events.BuildingSelected),
        place: (request = {}) => apply((state) => placeBuilding(state, request), Events.BuildingPlaced),
        upgrade: (buildingId) => apply((state) => upgradeBuilding(state, buildingId), Events.BuildingUpgraded),
        demolish: (buildingId) => apply((state) => demolishBuilding(state, buildingId), Events.BuildingDemolished)
      };
    }
  });
}
