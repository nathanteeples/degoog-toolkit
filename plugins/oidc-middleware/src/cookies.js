import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret } from "./state.js";

export const USER_COOKIE = "degoog-oidc-user";
export const SESSION_COOKIE = "settings-token";
export const OIDC_STATE = "oidc_state";
export const OIDC_NONCE = "oidc_nonce";
export const OIDC_VERIFIER = "oidc_verifier";
export const OIDC_RETURN_TO = "oidc_return_to";
export const OIDC_GATE_HOLD = "oidc_gate_hold";
const DEFAULT_GATE_HOLD_MAX_AGE_S = 10 * 60;

export const parseCookies = (header) => {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
};

export const readCookie = (req, name) =>
  parseCookies(req.headers.get("cookie"))[name];

export const isHttps = (req) => {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
};

export const bakeCookie = (name, value, opts = {}) => {
  const attrs = [`${name}=${value}`, `Path=${opts.path || "/"}`];
  if (opts.httpOnly !== false) attrs.push("HttpOnly");
  attrs.push(`SameSite=${opts.sameSite || "Lax"}`);
  if (opts.maxAge != null) attrs.push(`Max-Age=${opts.maxAge}`);
  if (opts.secure) attrs.push("Secure");
  return attrs.join("; ");
};

export const clearCookie = (name) => bakeCookie(name, "", { maxAge: 0 });

export const bakeGateHold = (req, reason, detail = "", maxAge = DEFAULT_GATE_HOLD_MAX_AGE_S) =>
  bakeCookie(
    OIDC_GATE_HOLD,
    Buffer.from(
      JSON.stringify({
        reason,
        detail,
        at: new Date().toISOString(),
        exp: Date.now() + maxAge * 1000,
      }),
    ).toString("base64url"),
    {
      httpOnly: true,
      sameSite: "Lax",
      maxAge,
      secure: isHttps(req),
    },
  );

export const readGateHold = (req) => {
  const raw = readCookie(req, OIDC_GATE_HOLD);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
};

const sign = (body) =>
  createHmac("sha256", getSecret()).update(body).digest("base64url");

export const signIdentity = (profile, ttlMs) => {
  const payload = { ...profile, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
};

export const readIdentity = (token) => {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    console.error("[oidc] identity decode failed:", err?.message || err);
    return null;
  }
};
