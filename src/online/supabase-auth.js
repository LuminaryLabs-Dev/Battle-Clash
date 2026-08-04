const AUTH_STORAGE_KEY = "battle-clash.auth.v1";

function config() {
  const env = import.meta.env ?? {};
  return {
    url: String(env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY ?? "")
  };
}

function storedSession(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(AUTH_STORAGE_KEY) ?? "null");
    return value?.access_token ? value : null;
  } catch {
    return null;
  }
}

function saveSession(session, storage = window.localStorage) {
  if (!session) storage.removeItem(AUTH_STORAGE_KEY);
  else storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function sessionFromRedirect(location = window.location) {
  const hash = new URLSearchParams(String(location.hash ?? "").replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const expiresIn = Number(hash.get("expires_in") ?? 3600);
  return accessToken && refreshToken ? {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + Math.max(1, expiresIn),
    token_type: hash.get("token_type") ?? "bearer"
  } : null;
}

function isExpired(session) {
  const expiresAt = Number(session?.expires_at ?? 0);
  return expiresAt > 0 && expiresAt * 1000 <= Date.now() + 5000;
}

export function buildProviderAuthorizeUrl(provider = "google", redirectTo = window.location.href, authConfig = config()) {
  const { url, anonKey } = authConfig;
  if (!url || !anonKey) throw new Error("Supabase Auth is not configured");
  const target = new URL(`${url}/auth/v1/authorize`);
  target.searchParams.set("provider", provider);
  target.searchParams.set("redirect_to", redirectTo);
  return target.toString();
}

async function request(path, options = {}, fetchImpl = globalThis.fetch, authConfig = config()) {
  const { url, anonKey } = authConfig;
  if (!url || !anonKey) throw new Error("Supabase Auth is not configured");
  const response = await fetchImpl(`${url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.msg ?? body.error_description ?? body.message ?? "Supabase Auth request failed");
  return body;
}

export function createSupabaseAuth({ storage = window.localStorage, onChange, fetchImpl = globalThis.fetch, location = window.location, authConfig = config() } = {}) {
  let session = sessionFromRedirect(location) ?? storedSession(storage);
  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  if (session) saveSession(session, storage);
  if (session?.access_token && sessionFromRedirect(location)?.access_token && typeof window !== "undefined" && window.history?.replaceState) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }

  function publish() {
    onChange?.(session ? {
      status: "authenticated",
      userId: session.user?.id ?? null,
      email: session.user?.email ?? null,
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? null
    } : {
      status: "signed-out",
      userId: null,
      email: null,
      accessToken: null,
      expiresAt: null
    });
  }

  async function signIn(email, password) {
    session = await request("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, fetchImpl, authConfig);
    saveSession(session, storage);
    publish();
    return session.user;
  }

  async function signUp(email, password) {
    const result = await request("signup", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, fetchImpl, authConfig);
    if (result.access_token) {
      session = result;
      saveSession(session, storage);
    }
    publish();
    return result.user ?? null;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return null;
    session = await request("token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token })
    }, fetchImpl, authConfig);
    saveSession(session, storage);
    publish();
    return session.user ?? null;
  }

  async function hydrateSession() {
    if (!session?.access_token) {
      readyResolve(null);
      return null;
    }
    try {
      if (isExpired(session) && session.refresh_token) await refreshSession();
      if (!session?.user && session?.access_token) {
        const user = await request("user", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        }, fetchImpl, authConfig);
        session = { ...session, user };
        saveSession(session, storage);
      }
      publish();
      readyResolve(session?.user ?? null);
      return session?.user ?? null;
    } catch {
      session = null;
      saveSession(null, storage);
      publish();
      readyResolve(null);
      return null;
    }
  }

  function signInWithProvider(provider = "google", redirectTo = location.href) {
    const target = buildProviderAuthorizeUrl(provider, redirectTo, authConfig);
    if (typeof window !== "undefined" && window.location) window.location.assign(target);
    return target;
  }

  async function signOut() {
    if (session?.access_token) {
      await request("logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      }, fetchImpl, authConfig).catch(() => undefined);
    }
    session = null;
    saveSession(null, storage);
    publish();
  }

  function getSession() {
    return session ? structuredClone(session) : null;
  }

  function getAccessToken() {
    return session?.access_token ?? null;
  }

  publish();
  void hydrateSession();
  return Object.freeze({ signIn, signUp, signInWithProvider, refreshSession, ready: () => ready, signOut, getSession, getAccessToken });
}
