const asArray = (v) =>
  Array.isArray(v)
    ? v.map(String)
    : typeof v === "string"
      ? v.split(/[\s,]+/).filter(Boolean)
      : [];

export const isAllowed = (config, claims) => {
  const gates = [
    [config.allowedEmails, [claims.email].filter(Boolean)],
    [config.allowedGroups, asArray(claims.groups)],
    [config.allowedRoles, asArray(claims.roles)],
  ].filter(([allow]) => allow.length > 0);
  if (gates.length === 0) return true;
  return gates.some(([allow, have]) => allow.some((a) => have.includes(a)));
};

export const toProfile = (claims) => {
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
    picture: typeof claims.picture === "string" ? claims.picture : "",
  };
};
