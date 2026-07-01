import {
  getConfig,
  getCtx,
  stashHandoff,
  sweepHandoffs,
} from "./state.js";
import { isConfigured } from "./settings.js";
import {
  readCookie,
  readGateHold,
  bakeGateHold,
  clearCookie,
  OIDC_STATE,
  OIDC_NONCE,
  OIDC_VERIFIER,
  OIDC_RETURN_TO,
} from "./cookies.js";
import {
  AVATAR_CACHE_TTL_MS,
  ensureAvatarEntry,
} from "./avatar.js";
import {
  exchangeCode,
  verifyIdToken,
  fetchUserInfo,
  handoffCode,
} from "./oidc.js";
import { chooseReturnTo } from "./return-to.js";
import {
  accessDenyDetail,
  evaluateAccess,
  readClaim,
  resolvePictureClaim,
  toProfile,
} from "./authz.js";
import { getAvatarCache } from "./state.js";
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

const gateHoldMeta = (hold) =>
  !hold
    ? null
    : {
        reason: typeof hold.reason === "string" ? hold.reason : "",
        detail: typeof hold.detail === "string" ? hold.detail : "",
        at: typeof hold.at === "string" ? hold.at : "",
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

const bounceWithHold = (req, reason, detail = "") =>
  new Response(null, {
    status: 302,
    headers: (() => {
      const returnTo = chooseReturnTo(
        originOf(req),
        [
          decodeURIComponent(readCookie(req, OIDC_RETURN_TO) || ""),
          req.headers.get("referer") || "",
        ],
        "/",
      );
      const headers = new Headers({ location: `${originOf(req)}${returnTo}` });
      headers.append("set-cookie", bakeGateHold(req, reason, detail));
      headers.append("set-cookie", clearCookie(OIDC_STATE));
      headers.append("set-cookie", clearCookie(OIDC_NONCE));
      headers.append("set-cookie", clearCookie(OIDC_VERIFIER));
      return headers;
    })(),
  });

const onAuthCheck = (req) => {
  const config = getConfig();
  const hold = readGateHold(req);
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
  const returnTo = chooseReturnTo(
    originOf(req),
    [
      url.searchParams.get("returnTo") || "",
      req.headers.get("referer") || "",
      decodeURIComponent(readCookie(req, OIDC_RETURN_TO) || ""),
    ],
    "/",
  );
  const loginUrl = ctx
    ? ctx.routeUrl(`login?returnTo=${encodeURIComponent(returnTo)}`)
    : "/api/settings/auth";
  const response = {
    required: true,
    valid: false,
    providerLabel: config.providerLabel || "OIDC",
    autoRedirect: config.autoRedirect === true,
    debug: config.debug === true,
    hold: gateHoldMeta(hold),
  };
  if (!hold) {
    response.loginUrl = loginUrl;
  } else {
    response.error = "auth-paused";
    response.autoRedirect = false;
  }
  debugLog("settings-auth.response", {
    request: requestMeta(req),
    config: configMeta(config),
    ctx: ctxMeta(),
    hold: gateHoldMeta(hold),
    returnTo,
    loginUrl: summarizeUrl(loginUrl),
    response,
  });
  return json(response);
};

export const userinfoNeeds = (config, claims) => {
  const missingIdentity =
    !claims.email && !claims.preferred_username && !claims.name;
  const missingPicture = !resolvePictureClaim(claims, config).picture;
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
      missingPicture ||
      missingGroups ||
      missingRoles ||
      missingEmailRule ||
      missingRequiredClaim,
    missingIdentity,
    missingPicture,
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
    hold: gateHoldMeta(readGateHold(req)),
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
    return bounceWithHold(req, "callback-rejected", "state-or-verifier-mismatch");
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
      const pictureOnly =
        needUserinfo.missingPicture &&
        !needUserinfo.missingIdentity &&
        !needUserinfo.missingGroups &&
        !needUserinfo.missingRoles &&
        !needUserinfo.missingEmailRule &&
        !needUserinfo.missingRequiredClaim;
      try {
        const extra = await fetchUserInfo(config, token.access_token);
        debugLog("settings-auth-callback.userinfo-response", {
          claims: claimsMeta(extra, config),
        });
        claims = { ...extra, ...claims };
      } catch (err) {
        if (!pictureOnly) throw err;
        debugError("settings-auth-callback.userinfo-picture-optional", err, {
          needUserinfo,
        });
      }
    }

    const access = evaluateAccess(config, claims);
    debugLog("settings-auth-callback.access", {
      allowed: access.allowed,
      access,
      claims: claimsMeta(claims, config),
    });
    if (!access.allowed) {
      const detail = accessDenyDetail(access);
      debugLog("settings-auth-callback.hold", {
        reason: "access-denied",
        detail,
        access,
      });
      return bounceWithHold(req, "access-denied", detail);
    }

    const code2 = handoffCode();
    const profile = toProfile(claims, config);
    await ensureAvatarEntry(getAvatarCache(), profile, token.access_token, AVATAR_CACHE_TTL_MS);
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
    return bounceWithHold(req, "callback-error", err?.message || "unknown");
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
