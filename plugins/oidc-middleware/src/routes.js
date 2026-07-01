import { getConfig, getCtx, claimHandoff } from "./state.js";
import { isConfigured } from "./settings.js";
import {
  readCookie,
  bakeCookie,
  readGateHold,
  clearCookie,
  isHttps,
  signIdentity,
  readIdentity,
  USER_COOKIE,
  SESSION_COOKIE,
  OIDC_GATE_HOLD,
  OIDC_STATE,
  OIDC_NONCE,
  OIDC_VERIFIER,
  OIDC_RETURN_TO,
} from "./cookies.js";
import { buildAuthUrl, makePkce, randomToken } from "./oidc.js";
import {
  configMeta,
  ctxMeta,
  debugError,
  debugLog,
  profileMeta,
  requestMeta,
  secretMeta,
  summarizeUrl,
} from "./debug.js";

const TEMP_MAX_AGE_S = 600;
const IDENTITY_TTL_MS = 12 * 60 * 60 * 1000;
const json = (obj, headers) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: headers || { "content-type": "application/json" },
  });

const redirect = (location, cookies = []) => {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
};

const originOf = (req) => getConfig()?.appUrl || new URL(req.url).origin;

const sanitizeReturnTo = (req, candidate) => {
  const origin = originOf(req);
  const fallback = "/settings";
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

const tempCookie = (name, value, req) =>
  bakeCookie(name, value, {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: TEMP_MAX_AGE_S,
    secure: isHttps(req),
  });

const onLogin = async (req) => {
  const config = getConfig();
  if (!isConfigured(config)) {
    debugLog("route.login.misconfigured", {
      request: requestMeta(req),
      config: configMeta(config),
    });
    return redirect(`${originOf(req)}/`);
  }
  try {
    const requestUrl = new URL(req.url);
    const returnTo = sanitizeReturnTo(req, requestUrl.searchParams.get("returnTo"));
    const pkce = makePkce();
    const state = randomToken();
    const nonce = randomToken();
    const redirectUri = `${originOf(req)}/api/settings/auth/callback`;
    const authUrl = await buildAuthUrl(config, redirectUri, pkce, state, nonce);
    debugLog("route.login.redirect", {
      request: requestMeta(req),
      config: configMeta(config),
      ctx: ctxMeta(),
      returnTo,
      redirectUri,
      authUrl: summarizeUrl(authUrl),
      state: secretMeta(state),
      nonce: secretMeta(nonce),
      verifier: secretMeta(pkce.verifier),
      challenge: secretMeta(pkce.challenge),
    });
    return redirect(authUrl, [
      clearCookie(OIDC_GATE_HOLD),
      tempCookie(OIDC_STATE, state, req),
      tempCookie(OIDC_NONCE, nonce, req),
      tempCookie(OIDC_VERIFIER, pkce.verifier, req),
      tempCookie(OIDC_RETURN_TO, encodeURIComponent(returnTo), req),
    ]);
  } catch (err) {
    debugError("route.login.error", err, {
      request: requestMeta(req),
      config: configMeta(config),
    });
    console.error("[oidc] login init failed:", err?.message || err);
    return redirect(`${originOf(req)}/?oidc_error=login`);
  }
};

const onClaim = (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("c") || "";
  const profile = code ? claimHandoff(code) : null;
  const returnTo = sanitizeReturnTo(
    req,
    decodeURIComponent(readCookie(req, OIDC_RETURN_TO) || "/settings"),
  );
  const clear = [
    clearCookie(OIDC_GATE_HOLD),
    clearCookie(OIDC_STATE),
    clearCookie(OIDC_NONCE),
    clearCookie(OIDC_VERIFIER),
    clearCookie(OIDC_RETURN_TO),
  ];
  if (!profile) {
    debugLog("route.claim.miss", {
      request: requestMeta(req),
      handoffCode: secretMeta(code),
      returnTo,
      hasReturnToCookie: Boolean(readCookie(req, OIDC_RETURN_TO)),
    });
    return redirect(`${originOf(req)}${returnTo}`, clear);
  }
  const identity = bakeCookie(USER_COOKIE, signIdentity(profile, IDENTITY_TTL_MS), {
    httpOnly: true,
    sameSite: "Lax",
    maxAge: IDENTITY_TTL_MS / 1000,
    secure: isHttps(req),
  });
  debugLog("route.claim.success", {
    request: requestMeta(req),
    handoffCode: secretMeta(code),
    returnTo,
    profile: profileMeta(profile),
    identityCookie: secretMeta(identity),
  });
  return redirect(`${originOf(req)}${returnTo}`, [identity, ...clear]);
};

const onMe = (req) => {
  const config = getConfig();
  const ctx = getCtx();
  const cookie = readCookie(req, USER_COOKIE);
  const identity = readIdentity(cookie);
  debugLog("route.me", {
    request: requestMeta(req),
    ctx: ctxMeta(),
    userCookie: secretMeta(cookie),
    authenticated: Boolean(identity),
    hold: readGateHold(req),
  });
  if (!identity) {
    return json({
      authenticated: false,
      debug: config?.debug === true,
      pluginId: ctx?.pluginId || ctx?.id || "",
      providerLabel: config?.providerLabel || "OIDC",
    });
  }
  return json({
    authenticated: true,
    email: identity.email || "",
    name: identity.name || "",
    picture: identity.picture || "",
    debug: config?.debug === true,
    pluginId: ctx?.pluginId || ctx?.id || "",
    providerLabel: config?.providerLabel || "OIDC",
  });
};

const onLogout = (req) => {
  debugLog("route.logout", {
    request: requestMeta(req),
    config: configMeta(getConfig()),
  });
  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", clearCookie(USER_COOKIE));
  headers.append("set-cookie", clearCookie(SESSION_COOKIE));
  headers.append("set-cookie", clearCookie(OIDC_GATE_HOLD));
  return json({ ok: true }, headers);
};

export const routes = [
  { method: "get", path: "login", handler: onLogin },
  { method: "get", path: "claim", handler: onClaim },
  { method: "get", path: "me", handler: onMe },
  { method: "post", path: "logout", handler: onLogout },
];
