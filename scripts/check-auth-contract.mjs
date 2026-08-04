import assert from "node:assert/strict";
import { buildProviderAuthorizeUrl, createSupabaseAuth } from "../src/online/supabase-auth.js";

const authConfig = { url: "https://example.supabase.co", anonKey: "anon-test" };
const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
const calls = [];
const user = { id: "user-shared-uuid", email: "player@example.test" };
const session = { access_token: "access-1", refresh_token: "refresh-1", user };
const refreshed = { access_token: "access-2", refresh_token: "refresh-2", user };
const fetchImpl = async (url, options = {}) => {
  calls.push({ url, options });
  if (url.includes("grant_type=refresh_token")) return response({ ...refreshed });
  if (url.endsWith("/signup")) return response({ user, access_token: session.access_token, refresh_token: session.refresh_token });
  if (url.includes("grant_type=password")) return response({ ...session });
  if (url.endsWith("/logout")) return response({});
  throw new Error(`Unexpected auth request: ${url}`);
};
function response(body, ok = true) {
  return { ok, json: async () => body };
}

const states = [];
const auth = createSupabaseAuth({ storage, location: { hash: "", href: "https://game.example/" }, authConfig, fetchImpl, onChange: (state) => states.push(state) });
assert.equal(auth.getSession(), null);
assert.equal((await auth.signUp("player@example.test", "not-persisted"))?.id, user.id);
assert.equal(auth.getSession().user.id, user.id);
assert.equal((await auth.refreshSession())?.id, user.id);
assert.equal(auth.getAccessToken(), refreshed.access_token);
await auth.signOut();
assert.equal(auth.getSession(), null);
assert.equal(values.size, 0, "sign-out must clear the local session");
assert.equal(states.at(-1).status, "signed-out");
const providerUrl = buildProviderAuthorizeUrl("google", "https://game.example/callback", authConfig);
const parsed = new URL(providerUrl);
assert.equal(parsed.searchParams.get("provider"), "google");
assert.equal(parsed.searchParams.get("redirect_to"), "https://game.example/callback");
assert.ok(calls.some(({ url }) => url.includes("/signup")));
assert.ok(calls.some(({ url }) => url.includes("grant_type=refresh_token")));
assert.ok(calls.some(({ url }) => url.endsWith("/logout")));
console.log("Auth contract: PASS (email signup, refresh, UUID continuity, logout, Google redirect, local session clearing)");
