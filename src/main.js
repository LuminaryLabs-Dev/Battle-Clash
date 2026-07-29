import "./styles.css";
import {
  createBattleClashGame,
  FIXED_DELTA
} from "./composition/create-battle-clash.js";
import { BATTLEFIELD } from "./data/battlefield.js";
import { createThreeHost } from "./hosts/three/three-host.js";
import { createPeerJsRoomAdapter } from "./network/peerjs-room-adapter.js";
import {
  loadProgressionProfile,
  saveProgressionProfile
} from "./persistence/profile-storage.js";

const elements = {
  canvas: document.querySelector("#game"),
  objective: document.querySelector("#objective"),
  phase: document.querySelector("#phaseValue"),
  time: document.querySelector("#timeValue"),
  raiders: document.querySelector("#raiderValue"),
  core: document.querySelector("#coreValue"),
  role: document.querySelector("#roleValue"),
  level: document.querySelector("#levelValue"),
  xp: document.querySelector("#xpValue"),
  xpFill: document.querySelector("#xpFill"),
  networkBadge: document.querySelector("#networkBadge"),
  deployMode: document.querySelector("#deployModeButton"),
  start: document.querySelector("#startRaidButton"),
  reset: document.querySelector("#resetButton"),
  fortify: document.querySelector("#fortifyButton"),
  playAgain: document.querySelector("#playAgainButton"),
  fieldPrompt: document.querySelector("#fieldPrompt"),
  resultPanel: document.querySelector("#resultPanel"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCopy: document.querySelector("#resultCopy"),
  domain: document.querySelector("#domainValue"),
  diagnostics: document.querySelector("#diagnosticValue"),
  network: document.querySelector("#networkValue"),
  error: document.querySelector("#errorPanel")
};

let game;
let host;
let network;
let accumulator = 0;
let previousTime = performance.now();
let latestSnapshot = null;
let remoteSnapshot = null;
let lastPublishedFrame = -Infinity;
let savedProgression = "";
let personalProfile = loadProgressionProfile();

function showError(error) {
  elements.error.hidden = false;
  elements.error.textContent = String(error?.stack ?? error?.message ?? error);
  document.body.dataset.ready = "error";
}

function isConnectedRole(snapshot, role) {
  return (
    snapshot.session.status === "connected" &&
    snapshot.session.role === role
  );
}

function objectiveFor(snapshot) {
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

function updateUi(snapshot) {
  latestSnapshot = snapshot;
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
  elements.time.textContent = snapshot.raid.timeRemaining.toFixed(1);
  elements.raiders.textContent = `${livingDelvers} + ${snapshot.deployment.remaining}`;
  elements.core.textContent = `${Math.round(coreRatio * 100)}%`;
  elements.role.textContent = snapshot.session.role.toUpperCase();
  elements.level.textContent = String(snapshot.progression.level);
  elements.xp.textContent =
    `${snapshot.progression.xp} / ${snapshot.progression.xpToNext} XP`;
  elements.xpFill.style.width = `${Math.min(100, xpRatio * 100)}%`;
  elements.networkBadge.textContent = badgeFor(snapshot.session);
  elements.networkBadge.dataset.status = snapshot.session.status;

  elements.deployMode.hidden = defender;
  elements.start.hidden = defender;
  elements.fortify.hidden = !defender;
  elements.start.disabled = snapshot.raid.phase !== "deploy";
  elements.deployMode.disabled =
    snapshot.deployment.remaining <= 0 ||
    !["deploy", "active"].includes(snapshot.raid.phase);
  elements.fortify.disabled =
    snapshot.raid.phase !== "active" ||
    snapshot.defense.wardCharges <= 0 ||
    snapshot.coreHealth.current >= snapshot.coreHealth.maximum;

  elements.fieldPrompt.hidden =
    defender || !["deploy", "active"].includes(snapshot.raid.phase);
  elements.fieldPrompt.textContent =
    snapshot.deployment.remaining > 0
      ? `Click a glowing blue edge tile to deploy · ${snapshot.deployment.remaining} delvers ready`
      : "The full party is deployed — watch the dungeon run unfold.";

  const terminal = ["won", "lost"].includes(snapshot.raid.phase);
  elements.resultPanel.hidden = !terminal;
  if (terminal) {
    const won = snapshot.raid.phase === "won";
    elements.resultTitle.textContent = won
      ? "Dungeon Heart shattered"
      : "The Obsidian Vault held";
    elements.resultCopy.textContent = defender
      ? won
        ? "The attacking party broke your Heart. Fortify later in the next run."
        : "Defense complete — the attacking delvers were stopped."
      : `${won ? "Vault cleared" : "Run ended"} · +${snapshot.progression.lastReward} XP · Level ${snapshot.progression.level}`;
  }

  elements.domain.textContent = snapshot.domains
    .filter(
      (domainPath) =>
        domainPath.includes("battle-clash") ||
        ["n:world", "n:core-network", "n:core-persistence"].includes(domainPath)
    )
    .join(" → ");
  elements.diagnostics.textContent =
    `Entities ${snapshot.entities.length} · Cells ${snapshot.activeCellCount} · Tick ${snapshot.frame} · Wards ${snapshot.defense.wardCharges}`;
  elements.network.textContent =
    `${snapshot.session.message} · ${snapshot.session.roomId ?? "no room"} · ${snapshot.session.authority} authority`;

  const serializedProgression = JSON.stringify(snapshot.progression);
  if (
    !isConnectedRole(snapshot, "defender") &&
    serializedProgression !== savedProgression
  ) {
    saveProgressionProfile(snapshot.progression);
    personalProfile = structuredClone(snapshot.progression);
    savedProgression = serializedProgression;
  }
}

function currentSnapshot() {
  const local = game.getSnapshot();
  if (network?.isRemoteAuthority() && remoteSnapshot) {
    return {
      ...remoteSnapshot,
      session: local.session
    };
  }
  return local;
}

function renderNow(timeSeconds = performance.now() / 1000) {
  const snapshot = currentSnapshot();
  updateUi(snapshot);
  host.render(snapshot, timeSeconds);

  if (
    isConnectedRole(snapshot, "defender") &&
    snapshot.frame - lastPublishedFrame >= 3
  ) {
    network.publishSnapshot(snapshot);
    lastPublishedFrame = snapshot.frame;
  }
  return snapshot;
}

function applyLocalCommand(command) {
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
    default:
      return false;
  }
  game.tick();
  return true;
}

function dispatchCommand(command) {
  const session = network?.getState() ?? game.getSnapshot().session;
  if (session.status === "connected" && session.role === "attacker") {
    return network.sendCommand(command);
  }
  if (
    session.status === "connected" &&
    session.role === "defender" &&
    !["fortify", "reset"].includes(command.kind)
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
  elements.deployMode.classList.toggle("hero-button--selected", next);
  elements.deployMode.setAttribute("aria-pressed", String(next));
  elements.fieldPrompt.textContent = next
    ? "Click a glowing blue edge tile to deploy a delver."
    : "Deployment targeting paused.";
}

function resetRun() {
  dispatchCommand({ kind: "reset" });
  host.setDeployMode(true);
  elements.deployMode.classList.add("hero-button--selected");
  elements.deployMode.setAttribute("aria-pressed", "true");
}

function frame(now) {
  const delta = Math.min(0.1, (now - previousTime) / 1000);
  previousTime = now;
  accumulator += delta;
  if (!network?.isRemoteAuthority()) {
    while (accumulator >= FIXED_DELTA) {
      game.tick();
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
    progression: personalProfile
  });
  host = createThreeHost({
    canvas: elements.canvas,
    canDeployAt,
    onDeploy(x, z) {
      dispatchCommand({ kind: "deploy", x, z });
    }
  });

  network = createPeerJsRoomAdapter({
    getProfile: () => currentSnapshot().progression,
    getAuthoritativeSnapshot: () => game.getSnapshot(),
    onCommand(command) {
      if (command.kind === "fortify") return;
      applyLocalCommand(command);
      renderNow();
    },
    onRemoteProfile(profile) {
      game.setProgression(profile);
      applyLocalCommand({ kind: "reset" });
      renderNow();
    },
    onRemoteSnapshot(snapshot) {
      remoteSnapshot = snapshot;
      saveProgressionProfile(snapshot.progression);
      personalProfile = structuredClone(snapshot.progression);
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
  });
  elements.playAgain.addEventListener("click", resetRun);

  window.addEventListener("keydown", (event) => {
    if (event.code === "Digit1") toggleDeployMode();
    if (event.code === "Space") {
      event.preventDefault();
      dispatchCommand({ kind: "start" });
    }
    if (event.code === "KeyR") resetRun();
    if (event.code === "KeyF") dispatchCommand({ kind: "fortify" });
  });
  window.addEventListener("beforeunload", () => network.destroy());

  window.__battleClash = Object.freeze({
    deployAt(x, z) {
      dispatchCommand({ kind: "deploy", x, z });
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
    getNetworkState: () => network.getState()
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
