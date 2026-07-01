import crypto from "node:crypto";
import { readClaim, resolvePictureClaim } from "./authz.js";
import { getConfig, getCtx } from "./state.js";

const PREFIX = "[oidc][debug]";
const MAX_ARRAY = 8;
const MAX_KEYS = 24;
const MAX_STRING = 160;
const URL_BASE = "http://degoog.local";
const SENSITIVE_KEY_RE =
  /^(?:token|idtoken|accesstoken|refreshtoken|clientsecret|cookiesecret|password|nonce|state|verifier|signature|assertion|code|handoffcode|usercookie|identitycookie)$/i;

const truncate = (value, max = MAX_STRING) => {
  const str = typeof value === "string" ? value : String(value ?? "");
  return str.length > max ? `${str.slice(0, max)}...` : str;
};

const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);

export const secretMeta = (value) => {
  const str = typeof value === "string" ? value : value == null ? "" : String(value);
  return str
    ? { present: true, length: str.length, sha256: hash(str) }
    : { present: false };
};

const preview = (value, depth = 0) => {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return truncate(value);
  if (Array.isArray(value)) {
    if (depth >= 2) return `[array:${value.length}]`;
    return value.slice(0, MAX_ARRAY).map((entry) => preview(entry, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= 2) return `[object:${Object.keys(value).length}]`;
    const out = {};
    for (const key of Object.keys(value).slice(0, MAX_KEYS)) {
      out[key] =
        SENSITIVE_KEY_RE.test(key) &&
        value[key] != null &&
        typeof value[key] !== "boolean" &&
        typeof value[key] !== "number"
          ? secretMeta(value[key])
          : preview(value[key], depth + 1);
    }
    return out;
  }
  return truncate(value);
};

export const summarizeUrl = (value) => {
  if (!value) return "";
  try {
    const url = new URL(String(value), URL_BASE);
    return {
      origin: url.origin === URL_BASE ? "" : url.origin,
      pathname: url.pathname,
      searchKeys: [...new Set(url.searchParams.keys())].slice(0, MAX_ARRAY),
      hasHash: Boolean(url.hash),
    };
  } catch {
    return truncate(value);
  }
};

export const requestMeta = (req) => {
  const url = new URL(req.url);
  return {
    method: req.method,
    pathname: url.pathname,
    searchKeys: [...new Set(url.searchParams.keys())].slice(0, MAX_ARRAY),
    host: truncate(req.headers.get("host") || ""),
    forwardedHost: truncate(req.headers.get("x-forwarded-host") || ""),
    forwardedProto: truncate(req.headers.get("x-forwarded-proto") || ""),
    referer: summarizeUrl(req.headers.get("referer") || ""),
    userAgent: truncate(req.headers.get("user-agent") || "", 100),
  };
};

export const ctxMeta = () => {
  const ctx = getCtx();
  if (!ctx) return null;
  return {
    pluginId: ctx.pluginId || ctx.id || "",
    apiBase: ctx.apiBase || "",
    loginRoute: typeof ctx.routeUrl === "function" ? ctx.routeUrl("login") : "",
    claimRoute: typeof ctx.routeUrl === "function" ? ctx.routeUrl("claim") : "",
  };
};

export const configMeta = (config = getConfig()) => {
  if (!config) return null;
  return {
    issuer: summarizeUrl(config.issuer || ""),
    appUrl: summarizeUrl(config.appUrl || ""),
    providerLabel: config.providerLabel || "OIDC",
    useAsSettingsGate: config.useAsSettingsGate === true,
    autoRedirect: config.autoRedirect === true,
    allowAnyAuthenticatedUser: config.allowAnyAuthenticatedUser === true,
    requireVerifiedEmail: config.requireVerifiedEmail !== false,
    scopes: truncate(config.scopes || ""),
    groupsScope: truncate(config.groupsScope || ""),
    groupsClaim: truncate(config.groupsClaim || ""),
    rolesClaim: truncate(config.rolesClaim || ""),
    pictureClaim: truncate(config.pictureClaim || ""),
    allowedEmails: preview(config.allowedEmails || []),
    allowedDomains: preview(config.allowedDomains || []),
    allowedGroups: preview(config.allowedGroups || []),
    allowedRoles: preview(config.allowedRoles || []),
    requiredClaims: preview(config.requiredClaims || []),
    hasClientSecret: Boolean(config.clientSecret),
    clientSecret: secretMeta(config.clientSecret),
    cookieSecret: secretMeta(config.cookieSecret),
    debug: config.debug === true,
  };
};

export const profileMeta = (profile) => ({
  sub: truncate(profile?.sub || "", 48),
  email: truncate(profile?.email || "", 120),
  name: truncate(profile?.name || "", 120),
  hasPicture: Boolean(profile?.picture),
});

export const claimsMeta = (claims, config = getConfig()) => {
  const picture = resolvePictureClaim(claims, config);
  const summary = {
    keys: Object.keys(claims || {}).sort().slice(0, MAX_KEYS),
    iss: truncate(claims?.iss || "", 120),
    sub: truncate(claims?.sub || "", 48),
    aud: preview(Array.isArray(claims?.aud) ? claims.aud : [claims?.aud].filter(Boolean)),
    email: truncate(claims?.email || "", 120),
    email_verified: claims?.email_verified ?? null,
    preferred_username: truncate(claims?.preferred_username || "", 80),
    name: truncate(claims?.name || "", 80),
    hasPicture: Boolean(picture.picture),
    pictureClaim: truncate(picture.path || "", 80),
    nonce: secretMeta(claims?.nonce || ""),
  };
  if (config) {
    summary.groups = preview(readClaim(claims, config.groupsClaim));
    summary.roles = preview(readClaim(claims, config.rolesClaim));
  }
  return summary;
};

export const errorMeta = (err) => ({
  name: truncate(err?.name || "Error", 80),
  message: truncate(err?.message || String(err), 240),
  stack: typeof err?.stack === "string"
    ? err.stack.split("\n").slice(0, 4).map((line) => truncate(line, 240))
    : [],
});

export const debugEnabled = () => getConfig()?.debug === true;

export const debugLog = (event, data = {}) => {
  if (!debugEnabled()) return;
  console.log(
    PREFIX,
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...preview(data),
    }),
  );
};

export const debugError = (event, err, data = {}) => {
  if (!debugEnabled()) return;
  console.error(
    PREFIX,
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      error: errorMeta(err),
      ...preview(data),
    }),
  );
};
