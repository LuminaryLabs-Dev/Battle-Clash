import {
  defineComponent,
  defineEvent,
  defineResource
} from "nexusengine/ecs";

export const Components = Object.freeze({
  Identity: defineComponent("battle-clash.identity"),
  Position: defineComponent("battle-clash.position"),
  Faction: defineComponent("battle-clash.faction"),
  Renderable: defineComponent("battle-clash.renderable"),
  Health: defineComponent("battle-clash.health"),
  Attack: defineComponent("battle-clash.attack"),
  Targeting: defineComponent("battle-clash.targeting"),
  Movement: defineComponent("battle-clash.movement"),
  Footprint: defineComponent("battle-clash.footprint"),
  Troop: defineComponent("battle-clash.troop"),
  Building: defineComponent("battle-clash.building"),
  Defense: defineComponent("battle-clash.defense")
});

export const Resources = Object.freeze({
  RaidState: defineResource("battle-clash.raid-state"),
  DeploymentState: defineResource("battle-clash.deployment-state"),
  CommandQueue: defineResource("battle-clash.command-queue"),
  EffectsState: defineResource("battle-clash.effects-state"),
  BattleMetadata: defineResource("battle-clash.metadata"),
  ProgressionState: defineResource("battle-clash.progression-state"),
  DefenseState: defineResource("battle-clash.defense-state"),
  SessionState: defineResource("battle-clash.session-state")
});

export const Events = Object.freeze({
  DeploymentAccepted: defineEvent("battle-clash.deployment.accepted"),
  DeploymentRejected: defineEvent("battle-clash.deployment.rejected"),
  TargetAcquired: defineEvent("battle-clash.target.acquired"),
  AttackResolved: defineEvent("battle-clash.attack.resolved"),
  EntityDestroyed: defineEvent("battle-clash.entity.destroyed"),
  RaidStarted: defineEvent("battle-clash.raid.started"),
  RaidCompleted: defineEvent("battle-clash.raid.completed"),
  RaidReset: defineEvent("battle-clash.raid.reset"),
  ProgressionAwarded: defineEvent("battle-clash.progression.awarded"),
  LevelGained: defineEvent("battle-clash.progression.level-gained"),
  DefenseFortified: defineEvent("battle-clash.defense.fortified"),
  SessionChanged: defineEvent("battle-clash.session.changed")
});
