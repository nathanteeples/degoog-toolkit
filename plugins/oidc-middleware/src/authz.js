const asArray = (v) =>
  Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v.split(/[\s,]+/).filter(Boolean)
      : [];

const DEFAULT_PICTURE_CLAIM_PATHS = [
  "picture",
  "avatar_url",
  "avatarUrl",
  "avatar",
  "image",
  "image.url",
  "photo",
  "photo_url",
  "photoUrl",
  "profile_image",
  "profile_image_url",
  "profile.picture",
  "profile.avatar",
  "user.picture",
  "user.avatar",
];

const safePicture = (value, base) => {
  if (typeof value !== "string") return "";
  const picture = value.trim();
  if (!picture) return "";
  if (/^data:image\//i.test(picture)) return picture;
  try {
    const url = base ? new URL(picture, base) : new URL(picture);
    return /^(https?):$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

export const readClaim = (claims, path) =>
  String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, segment) => {
      if (value == null) return undefined;
      if (Array.isArray(value) && /^\d+$/.test(segment)) {
        return value[Number.parseInt(segment, 10)];
      }
      if (typeof value !== "object") return undefined;
      return value[segment];
    }, claims);

const pictureClaimPaths = (config) => {
  const configured = typeof config?.pictureClaim === "string"
    ? config.pictureClaim.trim()
    : "";
  return [...new Set([configured, ...DEFAULT_PICTURE_CLAIM_PATHS].filter(Boolean))];
};

export const resolvePictureClaim = (claims, config) => {
  for (const path of pictureClaimPaths(config)) {
    const picture = safePicture(readClaim(claims, path), claims?.iss);
    if (picture) {
      return {
        path,
        picture,
      };
    }
  }
  return {
    path: pictureClaimPaths(config)[0] || "",
    picture: "",
  };
};

const matchesExpected = (actual, expected) => {
  if (Array.isArray(actual)) return actual.some((entry) => matchesExpected(entry, expected));
  if (actual == null) return false;
  return String(actual) === expected;
};

export const evaluateAccess = (config, claims) => {
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const emailVerified =
    claims.email_verified === true ||
    String(claims.email_verified || "").toLowerCase() === "true";
  const emailUsable =
    email && (!config.requireVerifiedEmail || emailVerified);

  const exactEmailMatch = emailUsable && config.allowedEmails.includes(email);
  const domainMatch =
    emailUsable &&
    config.allowedDomains.includes((email.split("@")[1] || "").toLowerCase());
  const groupsSeen = asArray(readClaim(claims, config.groupsClaim));
  const rolesSeen = asArray(readClaim(claims, config.rolesClaim));
  const groupMatch = config.allowedGroups.some((group) => groupsSeen.includes(group));
  const roleMatch = config.allowedRoles.some((role) => rolesSeen.includes(role));
  const requiredClaims = config.requiredClaims.map(({ claim, value }) => {
    const actual = readClaim(claims, claim);
    return {
      claim,
      expected: value,
      matched: matchesExpected(actual, value),
      actual,
    };
  });
  const requiredClaimsMatch = requiredClaims.every((entry) => entry.matched);

  const selectorConfigured =
    config.allowAnyAuthenticatedUser ||
    config.allowedEmails.length > 0 ||
    config.allowedDomains.length > 0 ||
    config.allowedGroups.length > 0 ||
    config.allowedRoles.length > 0;
  const selectorMatch =
    config.allowAnyAuthenticatedUser ||
    exactEmailMatch ||
    domainMatch ||
    groupMatch ||
    roleMatch;

  return {
    allowed: selectorConfigured ? selectorMatch && requiredClaimsMatch : false,
    email,
    emailVerified,
    emailUsable: Boolean(emailUsable),
    exactEmailMatch,
    domainMatch,
    groupMatch,
    roleMatch,
    groupsSeen,
    rolesSeen,
    requiredClaims,
    requiredClaimsMatch,
    selectorConfigured,
    selectorMatch,
  };
};

export const isAllowed = (config, claims) => evaluateAccess(config, claims).allowed;

export const accessDenyDetail = (access) => {
  if (!access.selectorConfigured) return "no-allow-rule";
  if (!access.emailUsable && access.email && access.emailVerified === false) {
    return "email-not-verified";
  }
  if (!access.selectorMatch && access.exactEmailMatch === false && access.email) {
    return "email-not-allowed";
  }
  if (!access.selectorMatch && access.groupMatch === false && access.groupsSeen.length > 0) {
    return "group-not-allowed";
  }
  if (!access.selectorMatch && access.roleMatch === false && access.rolesSeen.length > 0) {
    return "role-not-allowed";
  }
  if (!access.requiredClaimsMatch) return "required-claim-mismatch";
  return "selector-not-matched";
};

export const toProfile = (claims, config) => {
  const email = typeof claims.email === "string" ? claims.email : "";
  const name =
    claims.name ||
    claims.preferred_username ||
    (email ? email.split("@")[0] : "") ||
    claims.sub ||
    "user";
  return {
    sub: claims.sub || "",
    email,
    name: String(name),
    picture: resolvePictureClaim(claims, config).picture,
  };
};
