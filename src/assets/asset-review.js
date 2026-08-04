export const REVIEW_PERSPECTIVES = Object.freeze([
  "front",
  "rear",
  "side",
  "three-quarter",
  "top"
]);

export const REVIEW_CONTEXTS = Object.freeze([
  "sanctum",
  "territory",
  "combat"
]);

export function createReviewRun(assetId, passNumber = 1) {
  return {
    schema: "battle-clash.asset-review/1",
    assetId,
    passNumber,
    perspectives: REVIEW_PERSPECTIVES.map((perspective) => ({ perspective, decision: "pending" })),
    contexts: REVIEW_CONTEXTS.map((context) => ({ context, decision: "pending" })),
    humanDecision: "pending"
  };
}

export function reviewPassAccepted(run) {
  return [
    ...(run?.perspectives ?? []),
    ...(run?.contexts ?? [])
  ].every((entry) => entry.decision === "pass") && run?.humanDecision === "pass";
}

export function promoteAfterConsecutivePasses(runs = []) {
  const ordered = [...runs].sort((a, b) => Number(a.passNumber) - Number(b.passNumber));
  const tail = ordered.slice(-3);
  return tail.length === 3 && tail.every(reviewPassAccepted);
}
