export const DEFAULT_RETURN_FALLBACK = "/";

export const sanitizeReturnTo = (origin, candidate, fallback = DEFAULT_RETURN_FALLBACK) => {
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

export const chooseReturnTo = (origin, candidates = [], fallback = "/") => {
  for (const candidate of candidates) {
    const value = sanitizeReturnTo(origin, candidate, "");
    if (value) return value;
  }
  return fallback;
};
