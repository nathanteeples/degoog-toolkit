import {
  getConfig,
  getCtx,
  stashHandoff,
  sweepHandoffs,
} from "./state.js";
import { isConfigured } from "./settings.js";
import {
  readCookie,
  clearCookie,
  OIDC_STATE,
  OIDC_NONCE,
  OIDC_VERIFIER,
} from "./cookies.js";
import {
  exchangeCode,
  verifyIdToken,
  fetchUserInfo,
  handoffCode,
} from "./oidc.js";
import { evaluateAccess, readClaim, toProfile } from "./authz.js";
import {
  claimsMeta,
  configMeta,
  ctxMeta,
  debugError,
  debugLog,
  requestMeta,
  secretMeta,
  summarizeUrl,
} from "./debug.js";

const HANDOFF_TTL_MS = 2 * 60 * 1000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });

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

const originOf = (req) =>
  getConfig()?.appUrl || new URL(req.url).origin;

const bounce = (req) =>
  new Response(null, {
    status: 302,
    headers: (() => {
      const headers = new Headers({ location: `${originOf(req)}/` });
      for (const name of [OIDC_STATE, OIDC_NONCE, OIDC_VERIFIER]) {
        headers.append("set-cookie", clearCookie(name));
      }
      return headers;
    })(),
  });

const onAuthCheck = (req) => {
  const config = getConfig();
  if (!isConfigured(config)) {
    debugLog("settings-auth.misconfigured", {
      request: requestMeta(req),
      config: configMeta(config),
      ctx: ctxMeta(),
    });
    return json({
      required: true,
      valid: false,
      error: "auth-misconfigured",
      debug: config?.debug === true,
    });
  }
  const ctx = getCtx();
  const url = new URL(req.url);
  const returnTo = sanitizeReturnTo(
    req,
    url.searchParams.get("returnTo") || req.headers.get("referer") || "/settings",
  );
  const loginUrl = ctx
    ? ctx.routeUrl(`login?returnTo=${encodeURIComponent(returnTo)}`)
    : "/api/settings/auth";
  const response = {
    required: true,
    valid: false,
    loginUrl,
    providerLabel: config.providerLabel || "OIDC",
    autoRedirect: config.autoRedirect === true,
    debug: config.debug === true,
  };
  debugLog("settings-auth.response", {
    request: requestMeta(req),
    config: configMeta(config),
    ctx: ctxMeta(),
    returnTo,
    loginUrl: summarizeUrl(loginUrl),
    response,
  });
  return json(response);
};

const userinfoNeeds = (config, claims) => {
  const missingIdentity =
    !claims.email && !claims.preferred_username && !claims.name;
  const missingGroups =
    config.allowedGroups.length > 0 && readClaim(claims, config.groupsClaim) == null;
  const missingRoles =
    config.allowedRoles.length > 0 && readClaim(claims, config.rolesClaim) == null;
  const missingEmailRule =
    (config.allowedEmails.length > 0 || config.allowedDomains.length > 0) &&
    !claims.email;
  const missingRequiredClaim = config.requiredClaims.some(
    ({ claim }) => readClaim(claims, claim) == null,
  );
  return {
    needed:
      missingIdentity ||
      missingGroups ||
      missingRoles ||
      missingEmailRule ||
      missingRequiredClaim,
    missingIdentity,
    missingGroups,
    missingRoles,
    missingEmailRule,
    missingRequiredClaim,
  };
};

const onCallback = async (req) => {
  const config = getConfig();
  if (!isConfigured(config)) return bounce(req);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = readCookie(req, OIDC_STATE);
  const verifier = readCookie(req, OIDC_VERIFIER);
  const nonce = readCookie(req, OIDC_NONCE);

  debugLog("settings-auth-callback.start", {
    request: requestMeta(req),
    config: configMeta(config),
    hasCode: Boolean(code),
    hasStateParam: Boolean(state),
    savedState: secretMeta(savedState),
    stateParam: secretMeta(state),
    stateMatches: Boolean(state && savedState && state === savedState),
    verifier: secretMeta(verifier),
    nonce: secretMeta(nonce),
    callbackUrl: summarizeUrl(req.url),
  });

  if (!code || !state || !savedState || state !== savedState || !verifier) {
    debugLog("settings-auth-callback.reject", {
      reason: "state-or-verifier-mismatch",
      request: requestMeta(req),
      hasCode: Boolean(code),
      hasStateParam: Boolean(state),
      hasSavedState: Boolean(savedState),
      stateMatches: Boolean(state && savedState && state === savedState),
      hasVerifier: Boolean(verifier),
    });
    return bounce(req);
  }

  try {
    const redirectUri = `${originOf(req)}/api/settings/auth/callback`;
    const token = await exchangeCode(config, redirectUri, code, verifier);
    if (!token.id_token) throw new Error("no id_token in token response");

    debugLog("settings-auth-callback.token", {
      redirectUri,
      tokenType: token.token_type || "",
      scope: token.scope || "",
      expiresIn: token.expires_in ?? null,
      hasAccessToken: Boolean(token.access_token),
      hasIdToken: Boolean(token.id_token),
    });

    let claims = await verifyIdToken(config, token.id_token, nonce);
    debugLog("settings-auth-callback.id-token", {
      claims: claimsMeta(claims, config),
    });

    const needUserinfo = userinfoNeeds(config, claims);
    if (needUserinfo.needed) {
      debugLog("settings-auth-callback.userinfo-needed", needUserinfo);
      const extra = await fetchUserInfo(config, token.access_token);
      debugLog("settings-auth-callback.userinfo-response", {
        claims: claimsMeta(extra, config),
      });
      claims = { ...extra, ...claims };
    }

    const access = evaluateAccess(config, claims);
    debugLog("settings-auth-callback.access", {
      allowed: access.allowed,
      access,
      claims: claimsMeta(claims, config),
    });
    if (!access.allowed) {
      return bounce(req);
    }

    const code2 = handoffCode();
    const profile = toProfile(claims);
    sweepHandoffs();
    stashHandoff(code2, profile, HANDOFF_TTL_MS);
    const ctx = getCtx();
    const redirect = ctx ? ctx.routeUrl(`claim?c=${code2}`) : `${originOf(req)}/`;
    debugLog("settings-auth-callback.success", {
      profile,
      handoffCode: secretMeta(code2),
      redirect: summarizeUrl(redirect),
    });
    return { redirect };
  } catch (err) {
    debugError("settings-auth-callback.error", err, {
      request: requestMeta(req),
      config: configMeta(config),
    });
    console.error("[oidc] callback failed:", err?.message || err);
    return bounce(req);
  }
};

export const handle = async (req, context = {}) => {
  debugLog("middleware.handle", {
    route: context.route || "",
    request: requestMeta(req),
  });
  if (context.route === "settings-auth") return onAuthCheck(req);
  if (context.route === "settings-auth-callback") return onCallback(req);
  debugLog("middleware.skip", { route: context.route || "" });
  return null;
};
