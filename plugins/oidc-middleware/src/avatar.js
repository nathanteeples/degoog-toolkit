import crypto from "node:crypto";
import { debugError, debugLog, summarizeUrl } from "./debug.js";
import { pluginFetch } from "./state.js";

export const AVATAR_CACHE_NAMESPACE = "oidc-avatar";
export const AVATAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const MAX_AVATAR_BYTES = 512 * 1024;
const AVATAR_ACCEPT =
  "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";

export const createExtensionCache = (ctx, namespace, ttlMs) => {
  if (typeof ctx?.useCache === "function") {
    return ctx.useCache(namespace, ttlMs);
  }
  return typeof ctx?.createCache === "function"
    ? ctx.createCache(ttlMs)
    : null;
};

export const cacheGet = async (cache, key) => (cache ? await cache.get(key) : null);
export const cacheSet = async (cache, key, value, ttlMs) => {
  if (cache) await cache.set(key, value, ttlMs);
};
export const cacheDelete = async (cache, key) => {
  if (cache) await cache.delete(key);
};

export const avatarCacheKey = (identity = {}) => {
  const seed = [
    typeof identity.sub === "string" ? identity.sub : "",
    typeof identity.email === "string" ? identity.email : "",
    typeof identity.picture === "string" ? identity.picture : "",
  ].join("\u0000");
  return `avatar:${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
};

export const encodeAvatarCacheEntry = (bytes, contentType) => ({
  contentType,
  data: Buffer.from(bytes).toString("base64"),
});

export const decodeAvatarCacheEntry = (entry) => {
  if (!entry?.data) return null;
  return {
    bytes: Uint8Array.from(Buffer.from(entry.data, "base64")),
    contentType: entry.contentType || "image/png",
  };
};

const normalizeContentType = (value) =>
  String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

const isImageContentType = (value) => normalizeContentType(value).startsWith("image/");

const readAvatarResponse = async (response) => {
  const contentType = normalizeContentType(response.headers.get("content-type"));
  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (!isImageContentType(contentType)) return null;
  if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) return null;
  return { bytes, contentType };
};

export const fetchProfilePicture = async (pictureUrl, accessToken = "") => {
  if (!pictureUrl) return null;
  const attempts = accessToken
    ? [
        { name: "bearer", headers: { authorization: `Bearer ${accessToken}` } },
        { name: "direct", headers: {} },
      ]
    : [{ name: "direct", headers: {} }];

  for (const attempt of attempts) {
    try {
      debugLog("avatar.fetch.start", {
        url: summarizeUrl(pictureUrl),
        attempt: attempt.name,
        hasAccessToken: Boolean(accessToken),
      });
      const response = await pluginFetch(pictureUrl, {
        headers: {
          accept: AVATAR_ACCEPT,
          ...attempt.headers,
        },
        redirect: "follow",
      });
      debugLog("avatar.fetch.response", {
        url: summarizeUrl(pictureUrl),
        attempt: attempt.name,
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type") || "",
      });
      if (!response.ok) continue;
      const entry = await readAvatarResponse(response);
      if (entry) return entry;
    } catch (err) {
      debugError("avatar.fetch.error", err, {
        url: summarizeUrl(pictureUrl),
        attempt: attempt.name,
      });
    }
  }

  return null;
};

export const ensureAvatarEntry = async (
  cache,
  identity,
  accessToken = "",
  ttlMs = AVATAR_CACHE_TTL_MS,
) => {
  if (!identity?.picture) return null;

  const key = avatarCacheKey(identity);
  const cached = decodeAvatarCacheEntry(await cacheGet(cache, key));
  if (cached) return cached;

  const fetched = await fetchProfilePicture(identity.picture, accessToken);
  if (!fetched) return null;

  await cacheSet(cache, key, encodeAvatarCacheEntry(fetched.bytes, fetched.contentType), ttlMs);
  debugLog("avatar.cache.store", {
    key,
    contentType: fetched.contentType,
    bytes: fetched.bytes.byteLength,
  });
  return fetched;
};
