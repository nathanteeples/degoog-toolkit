import { randomBytes } from "node:crypto";

const PROCESS_SECRET = randomBytes(32).toString("base64url");

let _config = null;
let _ctx = null;
let _avatarCache = null;

const _handoffs = new Map();
const _avatarTokens = new Map();

export const setConfig = (config) => {
  _config = config;
};

export const getConfig = () => _config;

export const setCtx = (ctx) => {
  _ctx = ctx;
};

export const getCtx = () => _ctx;

export const setAvatarCache = (cache) => {
  _avatarCache = cache;
};

export const getAvatarCache = () => _avatarCache;

export const pluginFetch = (...args) => (_ctx?.fetch || fetch)(...args);

export const getSecret = () => _config?.cookieSecret || PROCESS_SECRET;

export const stashHandoff = (code, profile, ttlMs) => {
  _handoffs.set(code, { profile, exp: Date.now() + ttlMs });
};

export const claimHandoff = (code) => {
  const entry = _handoffs.get(code);
  if (!entry) return null;
  _handoffs.delete(code);
  return Date.now() > entry.exp ? null : entry.profile;
};

export const sweepHandoffs = () => {
  const now = Date.now();
  for (const [code, entry] of _handoffs) {
    if (now > entry.exp) _handoffs.delete(code);
  }
};

export const stashAvatarToken = (identity, accessToken, ttlMs) => {
  const sub = typeof identity?.sub === "string" ? identity.sub.trim() : "";
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!sub || !token) return;
  _avatarTokens.set(sub, { token, exp: Date.now() + ttlMs });
};

export const takeAvatarToken = (identity) => {
  const sub = typeof identity?.sub === "string" ? identity.sub.trim() : "";
  if (!sub) return "";
  const entry = _avatarTokens.get(sub);
  if (!entry || Date.now() > entry.exp) {
    _avatarTokens.delete(sub);
    return "";
  }
  return entry.token;
};

export const clearAvatarToken = (identity) => {
  const sub = typeof identity?.sub === "string" ? identity.sub.trim() : "";
  if (sub) _avatarTokens.delete(sub);
};
