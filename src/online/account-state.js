export const SIGNED_OUT_ACCOUNT = Object.freeze({
  schema: "battle-clash.account/1",
  status: "signed-out",
  userId: null,
  email: null,
  syncStatus: "offline",
  pendingReceipts: 0
});

export function accountStateFromAuth(authState, syncStatus = "idle", pendingReceipts = 0) {
  return {
    schema: "battle-clash.account/1",
    status: authState?.status ?? "signed-out",
    userId: authState?.userId ?? null,
    email: authState?.email ?? null,
    syncStatus,
    pendingReceipts: Number(pendingReceipts) || 0
  };
}
