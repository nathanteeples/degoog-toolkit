export const DEFAULT_SCOPES = "openid profile email";
export const DEFAULT_GROUPS_SCOPE = "groups";

const asStr = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const asBool = (v) => v === true || v === "true";

const asList = (v, key) => {
  let source = v;
  if (typeof source === "string") {
    const trimmed = source.trim();
    if (trimmed.startsWith("[")) {
      try {
        source = JSON.parse(trimmed);
      } catch {
        source = trimmed;
      }
    }
  }
  if (Array.isArray(source)) {
    return source
      .map((x) => {
        if (x && typeof x === "object") return asStr(x[key]).trim();
        return asStr(x).trim();
      })
      .filter(Boolean);
  }
  return asStr(source).split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
};

export const parseSettings = (raw = {}) => ({
  issuer: asStr(raw.issuer).trim().replace(/\/+$/, ""),
  clientId: asStr(raw.clientId).trim(),
  clientSecret: asStr(raw.clientSecret),
  appUrl: asStr(raw.appUrl).trim().replace(/\/+$/, ""),
  scopes: asStr(raw.scopes).trim() || DEFAULT_SCOPES,
  groupsScope: asStr(raw.groupsScope).trim() || DEFAULT_GROUPS_SCOPE,
  allowedEmails: asList(raw.allowedEmails, "email"),
  allowedGroups: asList(raw.allowedGroups, "group"),
  allowedRoles: asList(raw.allowedRoles, "role"),
  cookieSecret: asStr(raw.cookieSecret),
  debug: asBool(raw.debug),
});

export const isConfigured = (config) =>
  !!(config && config.issuer && config.clientId);

export const settingsSchema = [
  {
    key: "issuer",
    label: "Issuer URL",
    type: "url",
    required: true,
    placeholder: "https://auth.example.com/application/o/degoog/",
    description:
      "Your OpenID Connect issuer. The `.well-known/openid-configuration` document is discovered automatically.",
  },
  {
    key: "clientId",
    label: "Client ID",
    type: "text",
    required: true,
    description: "The client ID registered with your provider.",
  },
  {
    key: "clientSecret",
    label: "Client Secret",
    type: "password",
    secret: true,
    description:
      "Confidential clients (recommended) send this alongside PKCE. Leave blank only for public clients.",
  },
  {
    key: "appUrl",
    label: "App URL",
    type: "url",
    placeholder: "https://search.example.com",
    description:
      "External base URL used to build the redirect URI. Leave blank to derive it from the request. Set this when running behind a reverse proxy or on a subpath. Register `<App URL>/api/settings/auth/callback` as the redirect URI at your provider.",
  },
  {
    key: "scopes",
    label: "Scopes",
    type: "text",
    placeholder: DEFAULT_SCOPES,
    description: "Space separated scopes. Defaults to `openid profile email`.",
  },
  {
    key: "allowedEmails",
    label: "Allowed emails",
    type: "list",
    addLabel: "+ Add email",
    itemSchema: [
      { key: "email", label: "Email", type: "text", placeholder: "admin@example.com" },
    ],
    description:
      "Optional allowlist. When set, only these email addresses may unlock settings.",
  },
  {
    key: "allowedGroups",
    label: "Allowed groups",
    type: "list",
    addLabel: "+ Add group",
    itemSchema: [
      { key: "group", label: "Group", type: "text", placeholder: "admins" },
    ],
    description:
      "Optional allowlist. Requires your provider to send a `groups` claim.",
  },
  {
    key: "allowedRoles",
    label: "Allowed roles",
    type: "list",
    addLabel: "+ Add role",
    itemSchema: [
      { key: "role", label: "Role", type: "text", placeholder: "admin" },
    ],
    description:
      "Optional allowlist. Requires your provider to send a `roles` claim.",
  },
  {
    key: "groupsScope",
    label: "Groups scope",
    type: "text",
    placeholder: DEFAULT_GROUPS_SCOPE,
    description:
      "Extra scope requested when an allowed-groups list is set. Set to `no` to disable.",
  },
  {
    key: "cookieSecret",
    label: "Avatar cookie secret",
    type: "password",
    secret: true,
    description:
      "Optional. Signs the home-page avatar session. Set a stable value to keep avatars signed in across restarts or multiple instances. A random per-process secret is used when blank.",
  },
  {
    key: "debug",
    label: "Debug logging",
    type: "toggle",
    description: "Log OIDC flow details to the server console.",
  },
];
