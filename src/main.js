import "./styles.css";
import {
  createBattleClashGame,
  FIXED_DELTA
} from "./composition/create-battle-clash.js";
import { ARCHETYPES, BATTLEFIELD } from "./data/battlefield.js";
import { isTerritorySceneId } from "./data/world.js";
import { createThreeHost } from "./hosts/three/three-host.js";
import { createPeerJsRoomAdapter } from "./network/peerjs-room-adapter.js";
import {
  loadProgressionProfile,
  loadWorldProfile,
  saveWorldProfile,
  saveProgressionProfile,
  loadContentProfile,
  saveContentProfile
} from "./persistence/profile-storage.js";
import { createSupabaseAuth } from "./online/supabase-auth.js";
import { createAccountSync } from "./online/account-sync.js";
import { accountStateFromAuth, SIGNED_OUT_ACCOUNT } from "./online/account-state.js";

const elements = {
  canvas: document.querySelector("#game"),
  sceneTransition: document.querySelector("#sceneTransition"),
  sceneTransitionPhase: document.querySelector("#sceneTransitionPhase"),
  sceneTransitionTitle: document.querySelector("#sceneTransitionTitle"),
  sceneTransitionProgress: document.querySelector("#sceneTransitionProgress"),
  objective: document.querySelector("#objective"),
  phase: document.querySelector("#phaseValue"),
  time: document.querySelector("#timeValue"),
  raiders: document.querySelector("#raiderValue"),
  core: document.querySelector("#coreValue"),
  role: document.querySelector("#roleValue"),
  level: document.querySelector("#levelValue"),
  xp: document.querySelector("#xpValue"),
  xpFill: document.querySelector("#xpFill"),
  accountStatus: document.querySelector("#accountStatus"),
  accountEmail: document.querySelector("#accountEmail"),
  accountPassword: document.querySelector("#accountPassword"),
  accountSignIn: document.querySelector("#accountSignInButton"),
  accountSignUp: document.querySelector("#accountSignUpButton"),
  accountGoogle: document.querySelector("#accountGoogleButton"),
  accountSync: document.querySelector("#accountSyncButton"),
  accountSignOut: document.querySelector("#accountSignOutButton"),
  accountExport: document.querySelector("#accountExportButton"),
  accountDelete: document.querySelector("#accountDeleteButton"),
  networkBadge: document.querySelector("#networkBadge"),
  partySigil: document.querySelector("#partySigil"),
  heartSigil: document.querySelector("#heartSigil"),
  raidClock: document.querySelector("#raidClock"),
  deployMode: document.querySelector("#deployModeButton"),
  start: document.querySelector("#startRaidButton"),
  reset: document.querySelector("#resetButton"),
  fortify: document.querySelector("#fortifyButton"),
  heroAbility: document.querySelector("#heroAbilityButton"),
  playAgain: document.querySelector("#playAgainButton"),
  returnAfterRaid: document.querySelector("#returnAfterRaidButton"),
  menuToggle: document.querySelector("#menuToggleButton"),
  menuClose: document.querySelector("#menuCloseButton"),
  systemMenu: document.querySelector("#systemMenu"),
  menuScrim: document.querySelector("[data-menu-close]"),
  loadoutReadout: document.querySelector("#loadoutReadout"),
  selectDelver: document.querySelector("#selectDelverButton"),
  selectLancer: document.querySelector("#selectLancerButton"),
  selectArcanist: document.querySelector("#selectArcanistButton"),
  contentPanel: document.querySelector("#contentPanel"),
  contentReadout: document.querySelector("#contentReadout"),
  craftEmberWard: document.querySelector("#craftEmberWardButton"),
  craftScoutLens: document.querySelector("#craftScoutLensButton"),
  craftGlassbreaker: document.querySelector("#craftGlassbreakerButton"),
  equipLastGear: document.querySelector("#equipLastGearButton"),
  fieldPrompt: document.querySelector("#fieldPrompt"),
  resultPanel: document.querySelector("#resultPanel"),
  resultEyebrow: document.querySelector("#resultEyebrow"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCopy: document.querySelector("#resultCopy"),
  worldPanel: document.querySelector("#worldPanel"),
  worldSceneTitle: document.querySelector("#worldSceneTitle"),
  worldTerritoryTitle: document.querySelector("#worldTerritoryTitle"),
  worldOwner: document.querySelector("#worldOwner"),
  worldMapNodes: document.querySelector("#worldMapNodes"),
  worldFronts: document.querySelector("#worldFronts"),
  worldHeroReadout: document.querySelector("#worldHeroReadout"),
  worldResources: document.querySelector("#worldResources"),
  enterFrontier: document.querySelector("#enterFrontierButton"),
  healArmy: document.querySelector("#healArmyButton"),
  recruitArmy: document.querySelector("#recruitArmyButton"),
  upgradeSanctum: document.querySelector("#upgradeSanctumButton"),
  tradeResources: document.querySelector("#tradeResourcesButton"),
  discoverNext: document.querySelector("#discoverNextButton"),
  claimTerritory: document.querySelector("#claimTerritoryButton"),
  enterEncounter: document.querySelector("#enterEncounterButton"),
  returnSanctum: document.querySelector("#returnSanctumButton"),
  domain: document.querySelector("#domainValue"),
  diagnostics: document.querySelector("#diagnosticValue"),
  network: document.querySelector("#networkValue"),
  error: document.querySelector("#errorPanel")
};

const FRONT_GATE_GRID = Object.freeze({
  west: { x: 1, z: 50 },
  east: { x: 98, z: 50 },
  north: { x: 50, z: 1 },
  south: { x: 50, z: 98 }
});

let game;
let host;
let network;
let accumulator = 0;
let previousTime = performance.now();
let latestSnapshot = null;
let remoteSnapshot = null;
let lastPublishedFrame = -Infinity;
let savedProgression = "";
let savedWorld = "";
let personalProfile = loadProgressionProfile();
let personalWorld = loadWorldProfile();
let savedContent = "";
let personalContent = loadContentProfile();
let previousPhase = null;
let cueTimeout = null;
let menuOpen = false;
let auth;
let accountSync;
let accountState = structuredClone(SIGNED_OUT_ACCOUNT);
let submittedMatchReceiptIdentity = null;
let accountHydrationUserId = null;
let accountHydrationPromise = null;

function showError(error) {
  elements.error.hidden = false;
  elements.error.textContent = String(error?.stack ?? error?.message ?? error);
  document.body.dataset.ready = "error";
}

function updateAccountUi(next = accountState) {
  accountState = { ...accountState, ...next };
  if (game) game.updateAccount(accountState);
  if (elements.accountStatus) {
    const label = accountState.status === "authenticated"
      ? `${accountState.email ?? "Luminary delver"} · ${accountState.syncStatus}`
      : "Offline profile · local saves active";
    elements.accountStatus.textContent = `${label}${accountState.pendingReceipts ? ` · ${accountState.pendingReceipts} queued` : ""}`;
    elements.accountSync.disabled = accountState.status !== "authenticated";
    elements.accountSignOut.hidden = accountState.status !== "authenticated";
    elements.accountSignIn.hidden = accountState.status === "authenticated";
    elements.accountSignUp.hidden = accountState.status === "authenticated";
    elements.accountGoogle.hidden = accountState.status === "authenticated";
    elements.accountExport.hidden = accountState.status !== "authenticated";
    elements.accountDelete.hidden = accountState.status !== "authenticated";
  }
}

function updateContentUi(snapshot) {
  const content = snapshot.content ?? {};
  const inventory = content.inventory ?? [];
  const equipped = Object.values(content.equipped ?? {}).filter(Boolean);
  const rooms = (content.sanctumRooms ?? []).filter((room) => room.status === "unlocked").map((room) => room.kind);
  if (elements.contentReadout) {
    elements.contentReadout.textContent = `${inventory.length ? inventory.join(" · ") : "No gear recovered"}${equipped.length ? ` · Equipped: ${equipped.join(" · ")}` : ""}${rooms.length ? ` · Rooms: ${rooms.join(" · ")}` : ""}`;
  }
  const sanctum = snapshot.scene?.current === "sanctum";
  for (const button of [elements.craftEmberWard, elements.craftScoutLens, elements.craftGlassbreaker, elements.equipLastGear]) {
    if (button) button.disabled = !sanctum;
  }
  const lastGear = content.lastLoot?.itemId ?? inventory.at(-1) ?? null;
  if (elements.equipLastGear) {
    elements.equipLastGear.disabled = !sanctum || !lastGear || inventory.length === 0;
    elements.equipLastGear.dataset.itemId = lastGear ?? "";
  }
}

async function syncAccount() {
  if (!accountSync || accountState.status !== "authenticated") {
    showCue("Sign in to sync the Luminary profile.", 1800);
    return;
  }
  updateAccountUi({ syncStatus: "syncing" });
  const result = await accountSync.pushSnapshot();
  updateAccountUi({ syncStatus: result.queued ? "queued" : "synced", pendingReceipts: accountSync.pending() });
  showCue(result.queued ? "Profile queued for sync." : "Profile synced to Luminary.", 1800);
}

async function exportAccountProfile() {
  if (!accountSync || accountState.status !== "authenticated") {
    showCue("Sign in to export the Luminary profile.", 1800);
    return;
  }
  const payload = await accountSync.exportProfile();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `battle-clash-profile-${accountState.userId ?? "export"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showCue("Profile export downloaded.", 1800);
}

async function deleteAccountProfile() {
  if (!accountSync || accountState.status !== "authenticated") {
    showCue("Sign in to manage the Luminary profile.", 1800);
    return;
  }
  if (!window.confirm("Delete this Luminary profile? This cannot be undone.")) return;
  await accountSync.requestAccountDeletion();
  for (const key of [
    "battle-clash.profile.v1",
    "battle-clash.world-profile.v1",
    "battle-clash.content-profile.v1",
    "battle-clash.sync-queue.v1",
    "battle-clash.sync-conflicts.v1"
  ]) window.localStorage.removeItem(key);
  await auth.signOut();
  showCue("Profile deleted. Returning to offline play.", 2200);
  window.setTimeout(() => window.location.reload(), 450);
}

function applyRemoteProfile(result) {
  const profile = result?.profile ?? result ?? {};
  const snapshot = profile?.snapshot;
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.progression) game.setProgression(snapshot.progression);
  if (snapshot.world) game.setWorldProfile?.(snapshot.world);
  if (snapshot.content) game.setContentProfile?.(snapshot.content);
  renderNow();
  return true;
}

async function hydrateAccountProfile(userId) {
  if (!accountSync || accountState.status !== "authenticated" || !userId) return null;
  if (accountHydrationUserId === userId) return accountHydrationPromise;
  accountHydrationUserId = userId;
  accountHydrationPromise = (async () => {
    await accountSync.flushQueue();
    const localPush = await accountSync.pushSnapshot();
    if (localPush.conflict) {
      const remote = await accountSync.pullProfile();
      applyRemoteProfile(remote);
    }
    updateAccountUi({
      syncStatus: localPush.queued ? "queued" : localPush.conflict ? "conflict" : "synced",
      pendingReceipts: accountSync.pending()
    });
    return localPush;
  })().catch((error) => {
    updateAccountUi({ syncStatus: "queued", pendingReceipts: accountSync.pending() });
    return { queued: true, error: error.message };
  });
  return accountHydrationPromise;
}

function isConnectedRole(snapshot, role) {
  return (
    snapshot.session.status === "connected" &&
    snapshot.session.role === role
  );
}

function objectiveFor(snapshot) {
  if (snapshot.scene?.current === "sanctum") {
    return "Gather your army at Dawnwatch Sanctum, then open the frontier and choose your next territory.";
  }
  if (snapshot.scene?.current === "overworld") {
    return "Follow the connected territory web. Discover a neighboring grid, then enter its contested scene.";
  }
  if (isTerritorySceneId(snapshot.scene?.current)) {
    return "Read the fronts and enter a directional encounter to change this territory's future.";
  }
  if (snapshot.scene?.current === "encounter" && snapshot.objective) {
    const objective = snapshot.objective;
    const room = snapshot.room?.roomId
      ? `Room ${Number(snapshot.room.index ?? 0) + 1}/${snapshot.room.total} · ${snapshot.room.kind}`
      : null;
    if (objective.completed) return `${room ? `${room} · ` : ""}${objective.title} complete. Finish the assault on the Dungeon Heart.`;
    return `${room ? `${room} · ` : ""}${objective.title}: ${objective.description} (${objective.progress}/${objective.required})`;
  }
  if (isConnectedRole(snapshot, "defender")) {
    return snapshot.raid.phase === "active"
      ? "Defend the Dungeon Heart. Trigger your ward after the delvers break through."
      : "A delver is linked to your room. Hold the Obsidian Vault.";
  }
  if (isConnectedRole(snapshot, "attacker")) {
    return snapshot.raid.phase === "active"
      ? "Your commands are live on the defender host. Shatter the Dungeon Heart."
      : "Matched as attacker. Deploy your leveled party, then begin the run.";
  }

  switch (snapshot.raid.phase) {
    case "deploy":
      return snapshot.deployment.remaining > 0
        ? "Deploy blue delvers on the glowing perimeter, then begin the dungeon run."
        : "The party is deployed. Start the run and shatter the purple Dungeon Heart.";
    case "active":
      return "Shatter the Dungeon Heart before time runs out. Reserves can join mid-run.";
    case "won":
      return "Vault cleared — XP awarded to your persistent delver profile.";
    case "lost":
      return "The dungeon held. Keep the XP and try a new deployment pattern.";
    default:
      return "Prepare the next dungeon run.";
  }
}

function badgeFor(session) {
  if (session.status === "connected") {
    return session.role === "attacker"
      ? "ATTACKER LINKED"
      : "DEFENDER LINKED";
  }
  if (session.status === "searching" && session.roomId) return "ROOM OPEN";
  if (session.status === "searching") return "MATCHMAKING";
  if (session.status === "degraded") return "SOLO FALLBACK";
  return "SOLO READY";
}

function showCue(message, duration = 2400) {
  window.clearTimeout(cueTimeout);
  elements.fieldPrompt.textContent = message;
  elements.fieldPrompt.hidden = false;
  for (const animation of elements.fieldPrompt.getAnimations()) {
    animation.cancel();
  }
  elements.fieldPrompt.animate(
    [
      { opacity: 0, transform: "translate(-50%, 6px)" },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.14 },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.76 },
      { opacity: 0, transform: "translate(-50%, -3px)" }
    ],
    {
      duration,
      easing: "ease-out",
      fill: "forwards"
    }
  );
  cueTimeout = window.setTimeout(() => {
    elements.fieldPrompt.hidden = true;
  }, duration);
}

function setMenuOpen(next) {
  menuOpen = Boolean(next);
  elements.systemMenu.hidden = !menuOpen;
  elements.menuToggle.setAttribute("aria-expanded", String(menuOpen));
  document.body.dataset.menuOpen = String(menuOpen);
  if (menuOpen) {
    elements.menuClose.focus();
  } else {
    elements.menuToggle.focus({ preventScroll: true });
  }
}

function announcePhase(snapshot) {
  if (snapshot.scene?.current !== "encounter") return;
  const defender = isConnectedRole(snapshot, "defender");
  switch (snapshot.raid.phase) {
    case "deploy":
      showCue(
        defender
          ? "The vault is listening."
          : "The blue perimeter is open. Place your delvers.",
        3900
      );
      break;
    case "active":
      showCue(
        defender
          ? "Hold the Heart. Your ward will answer when it bleeds."
          : "The gate is broken. Shatter the Heart.",
        3000
      );
      break;
    case "won":
      showCue("The Obsidian Heart is broken.", 2600);
      break;
    case "lost":
      showCue("The vault endures.", 2600);
      break;
    default:
      break;
  }
}

function isWorldScene(snapshot) {
  return ["sanctum", "overworld"].includes(snapshot.scene?.current)
    || isTerritorySceneId(snapshot.scene?.current);
}

function updateWorldUi(snapshot) {
  const sceneId = snapshot.scene?.current ?? "sanctum";
  const territoryScene = isTerritorySceneId(sceneId);
  const territory = snapshot.territory ?? {};
  const world = snapshot.world ?? {};
  const economy = snapshot.economy ?? { resources: {} };
  const resources = economy.resources ?? {};
  const discovered = world.discoveredTerritoryIds?.length ?? 0;
  const total = Object.keys(world.territories ?? {}).length || 6;
  const owner = territory.ownerFaction === "player"
    ? "PLAYER CONTROL"
    : `${String(territory.ownerFaction ?? "neutral").replaceAll("-", " ").toUpperCase()} FRONT`;
  const sanctumLevel = snapshot.sanctum?.level ?? 1;
  elements.worldSceneTitle.textContent = sceneId === "sanctum"
    ? `${snapshot.scene?.title ?? "Dawnwatch Sanctum"} · LV ${sanctumLevel}`
    : snapshot.scene?.title ?? "The Frontier";
  elements.worldTerritoryTitle.textContent = territory.title ?? "Connected territory web";
  elements.worldOwner.textContent = owner;
  elements.worldMapNodes.textContent = `${discovered} / ${total} DISCOVERED`;
  const fronts = territory.fronts ?? [];
  const pressure = fronts.length
    ? Math.max(...fronts.map((front) => Number(front.pressure ?? 0)))
    : 0;
  elements.worldFronts.textContent = fronts.length
    ? `${fronts.length} FRONTS · PRESSURE ${Math.round(pressure * 100)}%`
    : "NO ACTIVE FRONT";
  const heroUnlocks = (snapshot.hero?.unlocks ?? [])
    .filter((unlock) => unlock !== "scouting")
    .map((unlock) => unlock.replaceAll("-", " "));
  elements.worldHeroReadout.textContent = `${snapshot.hero?.name ?? "EMBER"} · LV ${snapshot.hero?.level ?? 1} · SCOUT R${snapshot.hero?.discoveryRadius ?? 2}${heroUnlocks.length ? ` · ${heroUnlocks.join(" · ")}` : ""}`;
  const resourceValue = (key) => Math.floor(Number(resources[key] ?? 0));
  elements.worldResources.textContent = `G ${resourceValue("gold")} · F ${resourceValue("food")} · I ${resourceValue("iron")} · A ${resourceValue("arcane")}`;
  elements.worldPanel.hidden = false;
  elements.enterFrontier.hidden = sceneId !== "sanctum";
  elements.healArmy.hidden = sceneId !== "sanctum";
  elements.recruitArmy.hidden = sceneId !== "sanctum";
  elements.upgradeSanctum.hidden = sceneId !== "sanctum";
  elements.tradeResources.hidden = sceneId !== "sanctum";
  elements.discoverNext.hidden = sceneId !== "overworld";
  // Territory capture is encounter-owned in the player flow; the domain API
  // remains available for deterministic setup and server-side resolution.
  elements.claimTerritory.hidden = true;
  elements.enterEncounter.hidden = !territoryScene;
  elements.returnSanctum.hidden = sceneId === "sanctum";
  elements.enterFrontier.disabled = sceneId !== "sanctum";
  elements.healArmy.disabled = sceneId !== "sanctum";
  elements.recruitArmy.disabled = sceneId !== "sanctum";
  elements.upgradeSanctum.disabled = sceneId !== "sanctum";
  elements.tradeResources.disabled = sceneId !== "sanctum";
  elements.discoverNext.disabled = sceneId !== "overworld";
  elements.claimTerritory.disabled = true;
  elements.enterEncounter.disabled = !territoryScene;
  elements.returnSanctum.disabled = sceneId === "sanctum";
}

function updateUi(snapshot) {
  latestSnapshot = snapshot;
  updateTransitionUi(snapshot);
  updateContentUi(snapshot);
  const serializedContent = JSON.stringify(snapshot.content ?? null);
  if (snapshot.session?.status !== "connected" && serializedContent !== savedContent) {
    saveContentProfile(snapshot.content);
    personalContent = structuredClone(snapshot.content ?? {});
    savedContent = serializedContent;
  }
  const loadoutSnapshot = isConnectedRole(snapshot, "attacker") ? game.getSnapshot() : snapshot;
  const unlocked = new Set(loadoutSnapshot.army?.unlockedArchetypes ?? ["delver"]);
  const selected = loadoutSnapshot.deployment?.selectedArchetype ?? "delver";
  elements.loadoutReadout.textContent = `Selected: ${selected} · ${unlocked.size} unlocked`;
  elements.recruitArmy.textContent = `Recruit ${selected}`;
  elements.selectDelver.disabled = !unlocked.has("delver");
  elements.selectLancer.disabled = !unlocked.has("lancer");
  elements.selectArcanist.disabled = !unlocked.has("arcanist");
  for (const [button, id] of [[elements.selectDelver, "delver"], [elements.selectLancer, "lancer"], [elements.selectArcanist, "arcanist"]]) {
    button.classList.toggle("is-selected", selected === id);
  }
  const worldScene = isWorldScene(snapshot);
  if (worldScene) {
    updateWorldUi(snapshot);
    elements.objective.textContent = objectiveFor(snapshot);
    elements.phase.textContent = (snapshot.scene?.current ?? "sanctum").toUpperCase();
    elements.time.textContent = "—";
    elements.raiders.textContent = `${snapshot.army?.roster?.[0]?.count ?? 8}`;
    elements.core.textContent = "—";
    elements.role.textContent = snapshot.session.role.toUpperCase();
    elements.level.textContent = String(snapshot.progression.level);
    elements.xp.textContent = `${snapshot.progression.xp} / ${snapshot.progression.xpToNext} XP`;
    elements.xpFill.style.width = `${Math.min(100, (snapshot.progression.xp / snapshot.progression.xpToNext) * 100)}%`;
    elements.networkBadge.textContent = badgeFor(snapshot.session);
    elements.networkBadge.dataset.status = snapshot.session.status;
    elements.partySigil.hidden = false;
    elements.heartSigil.hidden = true;
    elements.deployMode.hidden = true;
    elements.start.hidden = true;
    elements.fortify.hidden = true;
    elements.heroAbility.hidden = true;
    elements.raidClock.hidden = true;
    elements.resultPanel.hidden = true;
    elements.returnAfterRaid.hidden = true;
    document.body.dataset.phase = worldScene ? "world" : snapshot.raid.phase;
    elements.domain.textContent = snapshot.domains
      .filter((domainPath) => domainPath.includes("battle-clash") || domainPath === "n:world")
      .join(" → ");
    elements.diagnostics.textContent = `Entities ${snapshot.entities.length} · Territories ${snapshot.world?.discoveredTerritoryIds?.length ?? 0}/${Object.keys(snapshot.world?.territories ?? {}).length || 6} · Tick ${snapshot.frame}`;
    elements.network.textContent = `${snapshot.session.message} · ${snapshot.session.roomId ?? "no room"} · ${snapshot.session.authority} authority`;
    const serializedWorld = JSON.stringify(snapshot.world);
    if (!isConnectedRole(snapshot, "defender") && serializedWorld !== savedWorld) {
      saveWorldProfile(snapshot.world);
      personalWorld = structuredClone(snapshot.world);
      savedWorld = serializedWorld;
    }
    return;
  }
  elements.worldPanel.hidden = true;
  elements.heartSigil.hidden = false;
  const coreRatio = snapshot.coreHealth.maximum
    ? snapshot.coreHealth.current / snapshot.coreHealth.maximum
    : 0;
  const livingDelvers = snapshot.entities.filter(
    (entity) => entity.category === "troop" && entity.health?.current > 0
  ).length;
  const defender = isConnectedRole(snapshot, "defender");
  const xpRatio = snapshot.progression.xpToNext
    ? snapshot.progression.xp / snapshot.progression.xpToNext
    : 0;

  elements.objective.textContent = objectiveFor(snapshot);
  elements.phase.textContent = snapshot.raid.phase.toUpperCase();
  elements.time.textContent = String(Math.ceil(snapshot.raid.timeRemaining));
  elements.raiders.textContent = `${livingDelvers}+${snapshot.deployment.remaining}`;
  elements.core.textContent = String(Math.round(coreRatio * 100));
  elements.role.textContent = snapshot.session.role.toUpperCase();
  elements.level.textContent = String(snapshot.progression.level);
  elements.xp.textContent =
    `${snapshot.progression.xp} / ${snapshot.progression.xpToNext} XP`;
  elements.xpFill.style.width = `${Math.min(100, xpRatio * 100)}%`;
  elements.networkBadge.textContent = badgeFor(snapshot.session);
  elements.networkBadge.dataset.status = snapshot.session.status;
  elements.partySigil.setAttribute(
    "aria-label",
    `${livingDelvers} active delvers and ${snapshot.deployment.remaining} in reserve`
  );
  elements.heartSigil.setAttribute(
    "aria-label",
    `Dungeon Heart at ${Math.round(coreRatio * 100)} percent`
  );
  elements.heartSigil.style.setProperty("--heart-health", coreRatio.toFixed(4));
  elements.heartSigil.dataset.danger = String(
    snapshot.raid.phase === "active" && coreRatio > 0 && coreRatio < 0.34
  );
  elements.raidClock.style.setProperty(
    "--time-progress",
    Math.max(0, snapshot.raid.timeRemaining / BATTLEFIELD.raidDuration).toFixed(4)
  );
  document.body.dataset.phase = snapshot.raid.phase;

  const deploymentAvailable =
    !defender &&
    snapshot.deployment.remaining > 0 &&
    ["deploy", "active"].includes(snapshot.raid.phase);
  const fortificationAvailable =
    defender &&
    snapshot.raid.phase === "active" &&
    snapshot.defense.wardCharges > 0 &&
    snapshot.coreHealth.current < snapshot.coreHealth.maximum;
  elements.partySigil.hidden = defender;
  elements.deployMode.hidden = !deploymentAvailable;
  elements.deployMode.disabled = !deploymentAvailable;
  elements.start.hidden = defender || snapshot.raid.phase !== "deploy";
  elements.start.disabled = defender || snapshot.raid.phase !== "deploy";
  elements.fortify.hidden = !fortificationAvailable;
  elements.fortify.disabled = !fortificationAvailable;
  const abilityCooldown = Number(snapshot.ability?.cooldownRemaining ?? 0);
  elements.heroAbility.hidden = snapshot.raid.phase !== "active";
  elements.heroAbility.disabled = abilityCooldown > 0;
  elements.heroAbility.dataset.tooltip = abilityCooldown > 0
    ? `Arc burst · ${abilityCooldown.toFixed(1)}s`
    : "Arc burst · Q";
  elements.raidClock.hidden = snapshot.raid.phase !== "active";

  const terminal = ["won", "lost"].includes(snapshot.raid.phase);
  elements.resultPanel.hidden = !terminal;
  elements.returnAfterRaid.hidden = !terminal;
  if (terminal) {
    const won = snapshot.raid.phase === "won";
    const nextRoom = won && snapshot.room?.hasNext && !defender;
    elements.playAgain.setAttribute("aria-label", nextRoom ? "Enter next room" : "Begin next run");
    elements.playAgain.dataset.tooltip = nextRoom ? "Next room" : "Next run";
    elements.resultEyebrow.textContent = won
      ? "VAULT BROKEN"
      : "RUN ENDED";
    elements.resultTitle.textContent = won
      ? "Heart shattered"
      : "The vault endures";
    elements.resultCopy.textContent = defender
      ? won
        ? "The attacking party broke through."
        : "The delvers were stopped."
      : `+${snapshot.progression.lastReward} XP · Level ${snapshot.progression.level}${nextRoom ? " · Next room ready" : ""}`;
  }

  if (snapshot.raid.phase !== previousPhase) {
    previousPhase = snapshot.raid.phase;
    announcePhase(snapshot);
    if (["won", "lost"].includes(snapshot.raid.phase) && accountSync && accountState.status === "authenticated") {
      const receiptContext = network?.getReceiptContext?.() ?? {
        roomId: snapshot.session.roomId ?? "solo",
        authorityId: accountState.userId ?? "local",
        sequenceEnd: Number(snapshot.frame) || 1,
        authenticated: true
      };
      if (receiptContext.roomId === "solo" || receiptContext.authenticated) {
        const rewardIdempotencyKey = `battle-clash:${receiptContext.roomId}:${snapshot.progression.runs}:${snapshot.raid.phase}`;
        const identity = `${receiptContext.roomId}:${rewardIdempotencyKey}`;
        if (identity !== submittedMatchReceiptIdentity) {
          submittedMatchReceiptIdentity = identity;
          accountSync.pushMatchReceipt({
            roomId: receiptContext.roomId,
            authorityId: receiptContext.authorityId,
            result: snapshot.raid.phase,
            sequenceStart: 1,
            sequenceEnd: Math.max(receiptContext.sequenceEnd, Number(snapshot.frame) || 1),
          profileRevision: Number(snapshot.world?.revision) || 0,
            rewardIdempotencyKey
          }).then((result) => updateAccountUi({
            syncStatus: result.queued ? "queued" : result.conflict ? "conflict" : "synced",
            pendingReceipts: accountSync.pending()
          })).catch(() => updateAccountUi({ syncStatus: "queued", pendingReceipts: accountSync.pending() }));
        }
      }
    }
  }

  elements.domain.textContent = snapshot.domains
    .filter(
      (domainPath) =>
        domainPath.includes("battle-clash") ||
        ["n:world", "n:network", "n:runtime:persistence"].includes(domainPath)
    )
    .join(" → ");
  elements.diagnostics.textContent =
    `Entities ${snapshot.entities.length} · Cells ${snapshot.activeCellCount} · Tick ${snapshot.frame} · Wards ${snapshot.defense.wardCharges}`;
  elements.network.textContent =
    `${snapshot.session.message} · ${snapshot.session.roomId ?? "no room"} · ${snapshot.session.authority} authority`;

  const serializedProgression = JSON.stringify(snapshot.progression);
  if (
    snapshot.session.status !== "connected" &&
    serializedProgression !== savedProgression
  ) {
    saveProgressionProfile(snapshot.progression);
    personalProfile = structuredClone(snapshot.progression);
    savedProgression = serializedProgression;
  }
  const serializedWorld = JSON.stringify(snapshot.world);
  if (snapshot.session.status !== "connected" && serializedWorld !== savedWorld) {
    saveWorldProfile(snapshot.world);
    personalWorld = structuredClone(snapshot.world);
    savedWorld = serializedWorld;
  }
}

function updateTransitionUi(snapshot) {
  const transition = snapshot.transition;
  if (!transition || !elements.sceneTransition) return;
  const phase = String(transition.phase ?? "stable");
  const active = Boolean(transition.active) || phase === "failed";
  const destination = String(transition.toSceneId ?? "destination").replaceAll("-", " ");
  const labels = {
    exiting: "LEAVING THE CURRENT FRONT",
    preparing: "PREPARING THE ROUTE",
    loading: "READING THE TERRITORY",
    ready: "THE PATH IS OPEN",
    revealing: "ENTERING THE SCENE",
    failed: "ROUTE INTERRUPTED"
  };
  elements.sceneTransition.hidden = !active;
  elements.sceneTransition.dataset.phase = phase;
  elements.sceneTransition.setAttribute("aria-busy", String(active && phase !== "failed"));
  elements.sceneTransitionPhase.textContent = labels[phase] ?? "FOLLOWING THE FRONT";
  elements.sceneTransitionTitle.textContent = phase === "failed"
    ? "Return to a safe route"
    : `Entering ${destination}`;
  elements.sceneTransitionProgress.style.transform = `scaleX(${Math.max(0, Math.min(1, Number(transition.progress ?? 0)))})`;
  document.body.dataset.transition = phase;
}

function currentSnapshot() {
  const local = game.getSnapshot();
  if (network?.isRemoteAuthority() && remoteSnapshot) {
    return {
      ...remoteSnapshot,
      world: mergeRemoteWorld(local.world, remoteSnapshot.world),
      session: local.session
    };
  }
  return local;
}

function createPeerSnapshot(snapshot) {
  const world = snapshot.world;
  const relevantTerritories = Object.fromEntries(
    Object.entries(world.territories ?? {})
      .filter(([territoryId, territory]) =>
        territory.discovered || territory.controlled || territoryId === world.currentTerritoryId
      )
      .map(([territoryId, territory]) => [territoryId, {
        id: territory.id,
        ownerFaction: territory.ownerFaction,
        discovered: territory.discovered,
        controlled: territory.controlled,
        controlRevision: territory.controlRevision,
        fronts: territory.fronts,
        landscape: territory.landscape,
        landscapeRevision: territory.landscapeRevision,
        supplyEfficiency: territory.supplyEfficiency,
        unlocks: territory.unlocks
      }])
  );
  const entities = snapshot.entities
    .filter((entity) => snapshot.scene?.current === "encounter" && (entity.health || entity.category === "troop"))
    .map((entity) => {
      const compact = {
        id: entity.id,
        position: entity.position,
        health: entity.health ? { current: entity.health.current } : null,
        movement: entity.movement,
        targetId: entity.targetId
      };
      if (entity.category === "troop") {
        compact.archetypeId = entity.archetypeId;
        compact.category = entity.category;
        compact.role = entity.role;
        compact.faction = entity.faction;
      }
      return compact;
    });
  return {
    schema: snapshot.schema,
    frame: snapshot.frame,
    elapsed: snapshot.elapsed,
    scene: snapshot.scene,
    raid: snapshot.raid,
    deployment: snapshot.deployment,
    coreHealth: snapshot.coreHealth,
    defense: snapshot.defense,
    ability: snapshot.ability,
    objective: snapshot.objective,
    battleMetadata: snapshot.battleMetadata,
    progression: snapshot.progression,
    economy: snapshot.economy,
    army: snapshot.army,
    sanctum: snapshot.sanctum,
    loot: snapshot.loot,
    content: snapshot.content,
    effects: snapshot.effects,
    hero: snapshot.hero,
    landscape: snapshot.landscape,
    entities,
    world: {
      ...world,
      territories: relevantTerritories,
      factionStrategy: undefined
    }
  };
}

function mergeRemoteWorld(localWorld, remoteWorld) {
  if (!remoteWorld) return localWorld;
  const mergedTerritories = Object.fromEntries(
    Object.entries(localWorld.territories ?? {}).map(([territoryId, localTerritory]) => [
      territoryId,
      remoteWorld.territories?.[territoryId]
        ? { ...localTerritory, ...remoteWorld.territories[territoryId] }
        : localTerritory
    ])
  );
  return {
    ...localWorld,
    ...remoteWorld,
    factionStrategy: Object.fromEntries(
      Object.entries(localWorld.factionStrategy ?? {}).map(([faction, localStrategy]) => [
        faction,
        remoteWorld.factionStrategy?.[faction]
          ? { ...localStrategy, ...remoteWorld.factionStrategy[faction] }
          : localStrategy
      ])
    ),
    territories: mergedTerritories
  };
}

function hydrateRemoteEntities(snapshot) {
  const localEntities = game.getSnapshot().entities;
  const localById = new Map(localEntities.map((entity) => [entity.id, entity]));
  const remoteById = new Map(snapshot.entities.map((entity) => [entity.id, entity]));
  const merged = localEntities.map((entity) =>
    remoteById.has(entity.id)
      ? {
          ...entity,
          ...remoteById.get(entity.id),
          health: remoteById.get(entity.id).health
            ? { ...entity.health, ...remoteById.get(entity.id).health }
            : entity.health
        }
      : entity
  );
  for (const entity of snapshot.entities) {
    if (localById.has(entity.id)) continue;
    const archetype = ARCHETYPES[entity.archetypeId];
    merged.push({
      ...entity,
      renderable: {
        shape: "box",
        color: archetype?.color ?? "#94a3b8",
        emissive: archetype?.emissive ?? "#334155",
        size: archetype?.size ?? [1, 1, 1]
      }
    });
  }
  return merged;
}

function renderNow(timeSeconds = performance.now() / 1000) {
  const snapshot = currentSnapshot();
  updateUi(snapshot);
  host.render(snapshot, timeSeconds);

  if (
    isConnectedRole(snapshot, "defender") &&
    snapshot.frame - lastPublishedFrame >= 15
  ) {
    network.publishSnapshot(createPeerSnapshot(snapshot));
    lastPublishedFrame = snapshot.frame;
  }
  return snapshot;
}

function applyLocalCommand(command, { remote = false } = {}) {
  switch (command.kind) {
    case "deploy":
      game.deployAt(command.x, command.z);
      break;
    case "start":
      game.startRaid();
      break;
    case "reset":
      game.reset();
      break;
    case "fortify":
      game.fortify();
      break;
    case "hero-ability":
      game.useHeroAbility();
      break;
    case "scene":
      if (command.territoryId && ["territory", "encounter"].includes(command.sceneId)) {
        const prepared = game.prepareTerritory(command.territoryId);
        if (!prepared?.accepted) return false;
      }
      game.transitionToScene(command.sceneId, {
        territoryId: command.territoryId,
        frontDirection: command.frontDirection
      });
      break;
    case "discover":
      game.discoverTerritory(command.territoryId);
      break;
    case "claim":
      game.claimTerritory(command.territoryId);
      break;
    case "move-hero":
      game.moveHero({ x: command.x, z: command.z });
      break;
    case "heal-army":
      game.healArmy();
      break;
    case "recruit-army":
      game.recruitArmy({ archetype: command.archetype });
      break;
    case "select-archetype":
      game.selectArchetype(command.archetype, { allowLocked: remote });
      break;
    case "craft-gear":
      game.craftGear(command.itemId);
      break;
    case "equip-gear":
      game.equipGear(command.itemId);
      break;
    case "upgrade-sanctum":
      game.upgradeSanctum();
      break;
    case "trade-resources":
      game.tradeResources(command);
      break;
    case "interact-landmark":
      game.interactLandmark(command.landmarkId);
      break;
    default:
      return false;
  }
  game.tick();
  return true;
}

function dispatchCommand(command) {
  const session = network?.getState() ?? game.getSnapshot().session;
  if (session.status === "connected" && session.role === "attacker") {
    if (command.kind === "select-archetype") {
      game.selectArchetype(command.archetype);
    }
    return network.sendCommand(command);
  }
  if (
    session.status === "connected" &&
    session.role === "defender" &&
    !["fortify", "reset", "scene", "discover", "claim", "move-hero", "heal-army", "recruit-army", "select-archetype", "craft-gear", "equip-gear", "upgrade-sanctum", "trade-resources", "interact-landmark", "hero-ability"].includes(command.kind)
  ) {
    return false;
  }
  const applied = applyLocalCommand(command);
  if (applied) renderNow();
  return applied;
}

function canDeployAt(x, z) {
  if (!network?.isRemoteAuthority() || !remoteSnapshot) {
    return game.canDeployAt(x, z);
  }
  if (!["deploy", "active"].includes(remoteSnapshot.raid.phase)) return false;
  if (remoteSnapshot.deployment.remaining <= 0) return false;
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge < BATTLEFIELD.deployMin || edge > BATTLEFIELD.deployMax) {
    return false;
  }
  return !remoteSnapshot.entities.some(
    (entity) =>
      entity.category === "troop" &&
      entity.health?.current > 0 &&
      Math.hypot(entity.position.x - x, entity.position.z - z) < 0.9
  );
}

function toggleDeployMode() {
  if (latestSnapshot && isConnectedRole(latestSnapshot, "defender")) return;
  const next = !host.getDeployMode();
  host.setDeployMode(next);
  elements.deployMode.classList.toggle("is-selected", next);
  elements.deployMode.setAttribute("aria-pressed", String(next));
  showCue(
    next
      ? "The blue perimeter is open."
      : "Deployment focus released.",
    1700
  );
}

function resetRun() {
  dispatchCommand({ kind: "reset" });
  host.setDeployMode(true);
  elements.deployMode.classList.add("is-selected");
  elements.deployMode.setAttribute("aria-pressed", "true");
  if (menuOpen) setMenuOpen(false);
}

function advanceOrResetRun() {
  const snapshot = currentSnapshot();
  if (snapshot.raid?.phase === "won" && snapshot.room?.hasNext && !network?.isRemoteAuthority()) {
    const result = game.advanceRoom();
    if (result?.accepted) {
      host.setDeployMode(true);
      showCue(`Room ${Number(result.state.index) + 1} opened.`, 1800);
      renderNow();
      return result;
    }
  }
  resetRun();
  return { accepted: true, reset: true };
}

function transitionScene(sceneId, payload = {}) {
  if (network?.isRemoteAuthority()) {
    const sent = network.sendCommand({
      kind: "scene",
      sceneId,
      territoryId: payload.territoryId,
      frontDirection: payload.frontDirection
    });
    if (sent) showCue("Waiting for the host to open that scene.", 1700);
    return { accepted: sent, remote: true };
  }
  const result = game.transitionToScene(sceneId, payload);
  if (result?.accepted) {
    renderNow();
    showCue(sceneId === "encounter" ? "The front is live." : "The world shifts around your banner.", 1800);
  }
  return result;
}

function engageCurrentFront(preferredDirection = null) {
  const snapshot = currentSnapshot();
  if (!isTerritorySceneId(snapshot.scene?.current)) return false;
  const territoryId = snapshot.world.currentTerritoryId;
  const fronts = snapshot.territory?.fronts ?? [];
  const front = fronts
    .filter((candidate) => String(candidate.faction ?? "neutral") !== "player")
    .sort((left, right) => Number(right.pressure ?? 0) - Number(left.pressure ?? 0))
    .find((candidate) => !preferredDirection || candidate.direction === preferredDirection)
    ?? fronts.find((candidate) => candidate.direction === preferredDirection)
    ?? fronts[0];
  const direction = front?.direction ?? preferredDirection;
  const gate = FRONT_GATE_GRID[direction];
  if (!gate) {
    showCue("No directional front is open in this territory.", 1800);
    return false;
  }
  const path = game.findHeroPath(snapshot.hero.position, gate);
  if (path.status !== "resolved") {
    showCue("The terrain blocks the approach to that front.", 1800);
    return false;
  }
  if (network?.isRemoteAuthority()) {
    if (!network.sendCommand({ kind: "move-hero", ...gate })) return false;
    if (network.sendCommand({
      kind: "scene",
      sceneId: "encounter",
      territoryId,
      frontDirection: direction
    })) {
      showCue(`${String(direction).toUpperCase()} gate reached · front request sent.`, 1900);
      return true;
    }
    return false;
  }
  const moved = game.moveHero(gate);
  if (!moved?.accepted) return false;
  const result = transitionScene("encounter", {
    territoryId,
    frontDirection: direction
  });
  if (result?.accepted !== false) {
    showCue(`${String(direction).toUpperCase()} gate reached · front engaged.`, 1900);
    return true;
  }
  return false;
}

function discoverNextTerritory() {
  const snapshot = currentSnapshot();
  const current = snapshot.world?.territories?.[snapshot.world.currentTerritoryId];
  const nextId = Object.values(current?.neighbors ?? {})
    .find((territoryId) => !snapshot.world.discoveredTerritoryIds.includes(territoryId));
  if (!nextId) {
    showCue("Every connected path is known. Push deeper from the nearest front.", 2200);
    return false;
  }
  if (network?.isRemoteAuthority()) {
    const sent = network.sendCommand({ kind: "discover", territoryId: nextId });
    if (sent) network.sendCommand({ kind: "scene", sceneId: "territory", territoryId: nextId });
    return sent;
  }
  const discovered = game.discoverTerritory(nextId);
  if (!discovered.accepted) return false;
  const entered = game.enterTerritory(nextId);
  if (entered.accepted) renderNow();
  showCue(`Discovered ${snapshot.world.territories[nextId].title}.`, 2200);
  return entered.accepted;
}

function frame(now) {
  const delta = Math.min(0.1, (now - previousTime) / 1000);
  previousTime = now;
  accumulator += delta;
  if (!network?.isRemoteAuthority()) {
    while (accumulator >= FIXED_DELTA) {
      game.tick();
      game.tickEconomy(FIXED_DELTA);
      accumulator -= FIXED_DELTA;
    }
  } else {
    accumulator = 0;
  }
  renderNow(now / 1000);
  requestAnimationFrame(frame);
}

try {
  game = createBattleClashGame({
    progression: personalProfile,
    world: personalWorld,
    content: personalContent
  });
  auth = createSupabaseAuth({
    onChange(next) {
      updateAccountUi(accountStateFromAuth(next, next.status === "authenticated" ? "idle" : "offline"));
      if (next.status === "authenticated") {
        void hydrateAccountProfile(next.userId);
      } else {
        accountHydrationUserId = null;
        accountHydrationPromise = null;
      }
      if (host) renderNow();
    }
  });
  accountSync = createAccountSync({
    auth,
    getSnapshot: currentSnapshot,
    onSync(next) {
      updateAccountUi({
        syncStatus: next.status,
        pendingReceipts: accountSync?.pending?.() ?? accountState.pendingReceipts
      });
    }
  });
  updateAccountUi(accountState);
  host = createThreeHost({
    canvas: elements.canvas,
    canDeployAt,
    onTerritorySelect(territoryId) {
      const snapshot = currentSnapshot();
      if (snapshot.scene?.current !== "overworld") return;
      const known = snapshot.world.discoveredTerritoryIds.includes(territoryId);
      if (network?.isRemoteAuthority()) {
        if (!known && !network.sendCommand({ kind: "discover", territoryId })) return;
        if (network.sendCommand({ kind: "scene", sceneId: "territory", territoryId })) {
          showCue("Route request sent to the host.", 1700);
        }
        return;
      }
      if (!known && !game.discoverTerritory(territoryId).accepted) {
        showCue("That territory is outside the connected frontier.", 1800);
        return;
      }
      const entered = game.enterTerritory(territoryId);
      if (entered.accepted) {
        renderNow();
        showCue(`Entering ${snapshot.world.territories[territoryId]?.title ?? "the territory"}.`, 1800);
      }
    },
    onHeroMove(position) {
      const snapshot = currentSnapshot();
      if (!isTerritorySceneId(snapshot.scene?.current)) return;
      const path = game.findHeroPath(snapshot.hero.position, position);
      if (path.status !== "resolved") {
        showCue("The terrain blocks that route.", 1800);
        return;
      }
      if (network?.isRemoteAuthority()) {
        network.sendCommand({ kind: "move-hero", ...position });
        showCue(`Route sent to host · ${path.pathLength} cells.`, 1700);
        return;
      }
      game.moveHero(position);
      renderNow();
      showCue(`Hero route resolved · ${path.pathLength} cells.`, 1700);
    },
    onFrontSelect(direction) {
      engageCurrentFront(direction);
    },
    onLandmarkSelect(landmarkId) {
      const snapshot = currentSnapshot();
      if (!isTerritorySceneId(snapshot.scene?.current)) return;
      const landmarkEntity = snapshot.entities.find((entity) => entity.id === landmarkId && entity.category === "landmark");
      const target = landmarkEntity?.territoryMarker?.gridPosition;
      if (!target) return;
      const path = game.findHeroPath(snapshot.hero.position, target);
      if (path.status !== "resolved") {
        showCue("The terrain blocks the approach to that landmark.", 1800);
        return;
      }
      if (network?.isRemoteAuthority()) {
        if (!network.sendCommand({ kind: "move-hero", ...target })) return;
        if (network.sendCommand({ kind: "interact-landmark", landmarkId })) {
          showCue(`Landmark reached · interaction sent to host.`, 1700);
        }
        return;
      }
      if (!game.moveHero(target)?.accepted) return;
      const result = game.interactLandmark(landmarkId);
      if (result?.accepted) {
        renderNow();
        const reward = result.state?.lastLandmarkInteraction?.reward ?? {};
        const summary = Object.entries(reward).map(([key, value]) => `+${value} ${key}`).join(" · ");
        showCue(summary ? `Landmark gathered · ${summary}.` : "Landmark surveyed.", 1800);
      }
    },
    onDeploy(x, z) {
      dispatchCommand({ kind: "deploy", x, z });
      showCue("Delver bound to the perimeter.", 1400);
    }
  });

  network = createPeerJsRoomAdapter({
    getProfile: () => currentSnapshot().progression,
    getIdentity: () => ({
      userId: accountState.status === "authenticated" ? accountState.userId : null,
      profileRevision: currentSnapshot().world?.revision ?? 0
    }),
    getAuthoritativeSnapshot: () => createPeerSnapshot(game.getSnapshot()),
    onCommand(command) {
      applyLocalCommand(command, { remote: true });
      renderNow();
    },
    onRemoteProfile(profile) {
      game.setProgression(profile);
      applyLocalCommand({ kind: "reset" });
      renderNow();
    },
    onRemoteSnapshot(snapshot) {
      const localState = game.getSnapshot();
      if (snapshot.scene?.current !== localState.scene?.current) {
        if (snapshot.scene?.current === "encounter" && snapshot.world?.currentTerritoryId) {
          game.prepareTerritory(snapshot.world.currentTerritoryId);
          game.transitionToScene("encounter", {
            territoryId: snapshot.world.currentTerritoryId,
            frontDirection: snapshot.battleMetadata?.frontDirection
          });
        } else if (snapshot.scene?.current === "overworld") {
          game.transitionToScene("overworld");
        } else if (isTerritorySceneId(snapshot.scene?.current) && snapshot.world?.currentTerritoryId) {
          game.prepareTerritory(snapshot.world.currentTerritoryId);
          game.transitionToScene(snapshot.scene.current, {
            territoryId: snapshot.world.currentTerritoryId
          });
        } else if (snapshot.scene?.current === "sanctum") {
          game.transitionToScene("sanctum");
        }
      }
      const hydratedState = game.getSnapshot();
      remoteSnapshot = {
        ...hydratedState,
        ...snapshot,
        entities: hydrateRemoteEntities(snapshot),
        world: mergeRemoteWorld(hydratedState.world, snapshot.world)
      };
      renderNow();
    },
    onSessionChange(session) {
      const previousSession = game.getSnapshot().session;
      game.updateSession(session);
      if (
        previousSession.role === "defender" &&
        session.role === "solo"
      ) {
        game.setProgression(personalProfile);
        applyLocalCommand({ kind: "reset" });
      }
      renderNow();
    }
  });

  elements.deployMode.addEventListener("click", toggleDeployMode);
  elements.start.addEventListener("click", () => {
    dispatchCommand({ kind: "start" });
  });
  elements.reset.addEventListener("click", resetRun);
  elements.fortify.addEventListener("click", () => {
    dispatchCommand({ kind: "fortify" });
    showCue("The Heart answers.", 1800);
  });
  elements.heroAbility.addEventListener("click", () => {
    dispatchCommand({ kind: "hero-ability", abilityId: "arc-burst" });
    showCue("Ember releases an arc burst.", 1200);
  });
  elements.playAgain.addEventListener("click", advanceOrResetRun);
  elements.accountSignIn.addEventListener("click", async () => {
    try {
      await auth.signIn(elements.accountEmail.value.trim(), elements.accountPassword.value);
      showCue("Luminary account linked.", 1800);
    } catch (error) {
      updateAccountUi({ syncStatus: "auth-error" });
      showCue(error.message, 2400);
    }
  });
  elements.accountSignUp.addEventListener("click", async () => {
    try {
      await auth.signUp(elements.accountEmail.value.trim(), elements.accountPassword.value);
      showCue("Account created. Check email if confirmation is enabled.", 2400);
    } catch (error) {
      updateAccountUi({ syncStatus: "auth-error" });
      showCue(error.message, 2400);
    }
  });
  elements.accountGoogle.addEventListener("click", () => {
    try {
      auth.signInWithProvider("google");
    } catch (error) {
      updateAccountUi({ syncStatus: "auth-error" });
      showCue(error.message, 2400);
    }
  });
  elements.accountSync.addEventListener("click", () => syncAccount().catch((error) => showCue(error.message, 2200)));
  elements.accountExport.addEventListener("click", () => exportAccountProfile().catch((error) => showCue(error.message, 2200)));
  elements.accountDelete.addEventListener("click", () => deleteAccountProfile().catch((error) => showCue(error.message, 2200)));
  elements.accountSignOut.addEventListener("click", async () => {
    await auth.signOut();
    updateAccountUi(SIGNED_OUT_ACCOUNT);
    showCue("Offline profile restored.", 1800);
  });
  elements.returnAfterRaid.addEventListener("click", () => {
    const result = transitionScene("sanctum");
    if (result?.accepted !== false) {
      showCue("Loot secured at Dawnwatch Sanctum.", 2200);
      syncAccount().catch(() => undefined);
    }
  });
  elements.enterFrontier.addEventListener("click", () => transitionScene("overworld"));
  elements.healArmy.addEventListener("click", () => {
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "heal-army" })) showCue("Healing request sent to host.", 1700);
      return;
    }
    const result = game.healArmy();
    if (result.accepted) {
      renderNow();
      showCue("The army is restored at Dawnwatch.", 1800);
    } else showCue("The sanctum lacks the supplies to heal them.", 1800);
  });
  elements.recruitArmy.addEventListener("click", () => {
    const archetype = currentSnapshot().deployment?.selectedArchetype ?? "delver";
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "recruit-army", archetype })) showCue(`${archetype} recruitment request sent to host.`, 1700);
      return;
    }
    const result = game.recruitArmy({ archetype });
    if (result.accepted) {
      renderNow();
      showCue(`A ${archetype} joins the banner.`, 1800);
    } else showCue("Recruitment is unavailable.", 1800);
  });
  elements.upgradeSanctum.addEventListener("click", () => {
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "upgrade-sanctum" })) showCue("Upgrade request sent to host.", 1700);
      return;
    }
    const result = game.upgradeSanctum();
    if (result.accepted) {
      renderNow();
      showCue(`Dawnwatch rises to level ${result.state.sanctum.level}.`, 2000);
    } else showCue("The sanctum needs more gold and iron.", 1800);
  });
  elements.tradeResources.addEventListener("click", () => {
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "trade-resources", from: "iron", to: "gold", amount: 5 })) showCue("Trade request sent to host.", 1700);
      return;
    }
    const result = game.tradeResources({ from: "iron", to: "gold", amount: 5 });
    if (result.accepted) {
      renderNow();
      showCue("Five iron traded for frontier gold.", 1800);
    } else showCue("The sanctum cannot complete that trade.", 1800);
  });
  elements.selectDelver.addEventListener("click", () => {
    dispatchCommand({ kind: "select-archetype", archetype: "delver" });
    showCue("Delver loadout selected.", 1400);
  });
  elements.selectLancer.addEventListener("click", () => {
    dispatchCommand({ kind: "select-archetype", archetype: "lancer" });
    showCue("Lancer loadout selected.", 1400);
  });
  elements.selectArcanist.addEventListener("click", () => {
    dispatchCommand({ kind: "select-archetype", archetype: "arcanist" });
    showCue("Arcanist loadout selected.", 1400);
  });
  const craft = (itemId) => {
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "craft-gear", itemId })) showCue("Forge request sent to the defender Sanctum.", 1700);
      return;
    }
    const result = game.craftGear(itemId);
    renderNow();
    showCue(result.accepted ? `${itemId} forged at Dawnwatch.` : "The forge lacks the required materials.", 1800);
  };
  elements.craftEmberWard.addEventListener("click", () => craft("ember-ward"));
  elements.craftScoutLens.addEventListener("click", () => craft("scout-lens"));
  elements.craftGlassbreaker.addEventListener("click", () => craft("glassbreaker"));
  elements.equipLastGear.addEventListener("click", () => {
    const itemId = elements.equipLastGear.dataset.itemId;
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "equip-gear", itemId })) showCue("Loadout request sent to the defender Sanctum.", 1700);
      return;
    }
    const result = game.equipGear(itemId);
    renderNow();
    showCue(result.accepted ? `${itemId} equipped.` : "Recover the gear before equipping it.", 1800);
  });
  elements.discoverNext.addEventListener("click", discoverNextTerritory);
  elements.claimTerritory.addEventListener("click", () => {
    const territoryId = currentSnapshot().world.currentTerritoryId;
    if (network?.isRemoteAuthority()) {
      if (network.sendCommand({ kind: "claim", territoryId })) showCue("Claim request sent to host.", 1700);
      return;
    }
    const result = game.claimTerritory(territoryId);
    if (result.accepted) {
      renderNow();
      const reward = result.state.lastClaimReward?.resources;
      showCue(
        reward
          ? `Territory claimed. +${reward.gold} gold · +${reward.food} food · +${reward.iron} iron.`
          : "Territory claimed. Economy and routes answer to your banner.",
        2400
      );
    }
  });
  elements.enterEncounter.addEventListener("click", () => engageCurrentFront());
  elements.returnSanctum.addEventListener("click", () => transitionScene("sanctum"));
  elements.menuToggle.addEventListener("click", () => setMenuOpen(true));
  elements.menuClose.addEventListener("click", () => setMenuOpen(false));
  elements.menuScrim.addEventListener("click", () => setMenuOpen(false));

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault();
      setMenuOpen(!menuOpen);
      return;
    }
    if (menuOpen) return;
    if (event.code === "Digit1") toggleDeployMode();
    if (event.code === "Space") {
      event.preventDefault();
      dispatchCommand({ kind: "start" });
    }
    if (event.code === "KeyR") resetRun();
    if (event.code === "KeyF") dispatchCommand({ kind: "fortify" });
    if (event.code === "KeyQ") dispatchCommand({ kind: "hero-ability", abilityId: "arc-burst" });
  });
  window.addEventListener("beforeunload", () => network.destroy());

  window.__battleClash = Object.freeze({
    deployAt(x, z) {
      dispatchCommand({ kind: "deploy", x, z });
      showCue("Delver bound to the perimeter.", 1400);
      return currentSnapshot();
    },
    startRaid() {
      dispatchCommand({ kind: "start" });
      return currentSnapshot();
    },
    fortify() {
      dispatchCommand({ kind: "fortify" });
      return currentSnapshot();
    },
    useHeroAbility() {
      dispatchCommand({ kind: "hero-ability", abilityId: "arc-burst" });
      return currentSnapshot();
    },
    reset() {
      resetRun();
      return currentSnapshot();
    },
    step(seconds = 1) {
      if (!network.isRemoteAuthority()) game.stepSeconds(seconds);
      return renderNow();
    },
    getSnapshot: currentSnapshot,
    getDigest: () => game.getDigest(),
    getNetworkState: () => network.getState(),
    findHeroPath(start, goal) {
      return game.findHeroPath(start, goal);
    },
    findWorldPath(startId, goalId) {
      return game.findWorldPath(startId, goalId);
    },
    getAssetDiagnostics() {
      return host.getAssetDiagnostics?.() ?? { requested: [], loaded: [], failed: [] };
    },
    selectArchetype(archetype) {
      dispatchCommand({ kind: "select-archetype", archetype });
      return currentSnapshot();
    },
    recruitArmy(archetype = "delver") {
      dispatchCommand({ kind: "recruit-army", archetype });
      return currentSnapshot();
    },
    moveHero(position) {
      const snapshot = currentSnapshot();
      const path = game.findHeroPath(snapshot.hero.position, position);
      if (path.status !== "resolved") return path;
      game.moveHero(position);
      renderNow();
      return path;
    },
    setMenuOpen,
    transitionToScene: transitionScene,
    discoverNextTerritory,
    getContentState: () => game.getContentState(),
    craftGear(itemId) { return game.craftGear(itemId); },
    equipGear(itemId) { return game.equipGear(itemId); }
  });

  renderNow();
  document.body.dataset.ready = "true";
  console.info("Battle Clash ready", {
    domains: game.getSnapshot().domains,
    nexusEngine: true,
    transport: "peerjs"
  });
  requestAnimationFrame(frame);
  network.start();
} catch (error) {
  showError(error);
}
