const normalizePath = (value) => {
  const path = String(value || "").trim();
  if (!path) return "/";
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash === "/" ? withSlash : withSlash.replace(/\/+$/, "");
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

export const adminRoutePath = (req) => {
  const pathname = new URL(req.url).pathname;
  const basePath = pathname.replace(/\/api\/settings\/auth(?:\/callback)?\/?$/, "");
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
