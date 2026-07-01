import crypto from "node:crypto";
import { discover, fetchJwks } from "./discovery.js";
import { decodeJwt, verifyJwt, validateClaims } from "./jwt.js";
import { claimsMeta, debugError, debugLog, secretMeta, summarizeUrl } from "./debug.js";
import { pluginFetch } from "./state.js";

const b64url = (buf) => buf.toString("base64url");
const sha256 = (str) => crypto.createHash("sha256").update(str).digest();

export const makePkce = () => {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(sha256(verifier)) };
};

export const randomToken = () => b64url(crypto.randomBytes(16));
export const handoffCode = () => b64url(crypto.randomBytes(32));

const wantsGroups = (config) => {
  if (config.allowedGroups.length === 0) return false;
  const scope = config.groupsScope.toLowerCase();
  return !!scope && scope !== "no" && scope !== "false";
};

export const buildAuthUrl = async (config, redirectUri, pkce, state, nonce) => {
  const doc = await discover(config.issuer);
  const scope = wantsGroups(config)
    ? `${config.scopes} ${config.groupsScope}`
    : config.scopes;
  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  debugLog("oidc.build-auth-url", {
    issuer: summarizeUrl(config.issuer),
    authorizationEndpoint: summarizeUrl(doc.authorization_endpoint),
    redirectUri,
    scope,
    state: secretMeta(state),
    nonce: secretMeta(nonce),
    verifier: secretMeta(pkce.verifier),
    challenge: secretMeta(pkce.challenge),
  });
  return url.toString();
};

export const exchangeCode = async (config, redirectUri, code, verifier) => {
  const doc = await discover(config.issuer);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });
  const headers = { "content-type": "application/x-www-form-urlencoded" };
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  debugLog("oidc.exchange-code.request", {
    tokenEndpoint: summarizeUrl(doc.token_endpoint),
    redirectUri,
    code: secretMeta(code),
    verifier: secretMeta(verifier),
    hasClientSecret: Boolean(config.clientSecret),
  });
  const res = await pluginFetch(doc.token_endpoint, {
    method: "POST",
    headers,
    body,
  });
  debugLog("oidc.exchange-code.response", {
    tokenEndpoint: summarizeUrl(doc.token_endpoint),
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type") || "",
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  return res.json();
};

export const verifyIdToken = async (config, idToken, nonce) => {
  const doc = await discover(config.issuer);
  const jwks = await fetchJwks(doc.jwks_uri);
  const decoded = decodeJwt(idToken);
  debugLog("oidc.verify-id-token.start", {
    issuer: summarizeUrl(doc.issuer || config.issuer),
    jwksUri: summarizeUrl(doc.jwks_uri),
    header: decoded.header,
    parts: decoded.parts.map((part) => secretMeta(part)),
    nonce: secretMeta(nonce),
    jwksKeys: Array.isArray(jwks?.keys) ? jwks.keys.length : 0,
  });
  const claims = verifyJwt(idToken, jwks);
  validateClaims(claims, {
    issuer: doc.issuer || config.issuer,
    clientId: config.clientId,
    nonce,
  });
  debugLog("oidc.verify-id-token.success", {
    claims: claimsMeta(claims, config),
  });
  return claims;
};

export const fetchUserInfo = async (config, accessToken) => {
  const doc = await discover(config.issuer);
  if (!doc.userinfo_endpoint || !accessToken) return {};
  debugLog("oidc.userinfo.request", {
    endpoint: summarizeUrl(doc.userinfo_endpoint),
    accessToken: secretMeta(accessToken),
  });
  const res = await pluginFetch(doc.userinfo_endpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  debugLog("oidc.userinfo.response", {
    endpoint: summarizeUrl(doc.userinfo_endpoint),
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type") || "",
  });
  if (!res.ok) return {};
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("jwt")) {
    try {
      const payload = decodeJwt(await res.text()).payload;
      debugLog("oidc.userinfo.jwt", { claims: claimsMeta(payload, config) });
      return payload;
    } catch (err) {
      debugError("oidc.userinfo.jwt-error", err);
      console.error("[oidc] userinfo jwt decode failed:", err?.message || err);
      return {};
    }
  }
  const payload = await res.json();
  debugLog("oidc.userinfo.json", { claims: claimsMeta(payload, config) });
  return payload;
};
