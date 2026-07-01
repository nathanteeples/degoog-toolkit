const AUTH_PATH_SUFFIXES = [
  "/api/settings/auth/callback",
  "/api/settings/auth",
];

const trimTrailingSlash = (value) => {
  const path = String(value || "").replace(/\/+$/, "");
  return path || "/";
};

const normalizePath = (value) => {
  const path = String(value || "").trim();
  if (!path) return "/";
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return trimTrailingSlash(withSlash);
};

const envTruthy = (name) => {
  const value = String(process.env[name] || "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
};

const configuredAdminSegment = () => {
  const custom = String(process.env.DEGOOG_SETTINGS_PATH || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (custom) return custom;
  return envTruthy("DEGOOG_PUBLIC_INSTANCE") ? "admin" : "settings";
};

const basePathFromApiPath = (pathname) => {
  const normalized = trimTrailingSlash(pathname);
  for (const suffix of AUTH_PATH_SUFFIXES) {
    if (normalized === suffix) return "";
    if (normalized.endsWith(suffix)) {
      return normalized.slice(0, -suffix.length);
    }
  }
  return "";
};

export const adminRoutePath = (req) => {
  const url = new URL(req.url);
  const basePath = basePathFromApiPath(url.pathname);
  return normalizePath(`${basePath}/${configuredAdminSegment()}`);
};

export const targetsAdminRoute = (targetPath, adminPath) => {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedAdmin = normalizePath(adminPath);
  return (
    normalizedTarget === normalizedAdmin ||
    normalizedTarget.startsWith(`${normalizedAdmin}/`)
  );
};
