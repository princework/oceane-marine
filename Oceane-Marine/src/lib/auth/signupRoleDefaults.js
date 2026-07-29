/**
 * Legacy `User.roles` values allowed on public self-registration (see User schema enum).
 */
export const PUBLIC_SIGNUP_LEGACY_ROLES = [
  "REVIEWER",
  "EDITOR",
  "UPLOADER",
  "CUSTOM_EDITOR",
  "ADMIN",
];

/**
 * @param {unknown} role
 * @returns {string} valid User.roles enum value
 */
export function normalizePublicSignupLegacyRole(role) {
  let raw = "";
  if (typeof role === "string" || typeof role === "number" || typeof role === "boolean") {
    raw = String(role).trim();
  }
  const u = raw.toUpperCase();
  if (u === "VIEWER") {
    return "REVIEWER";
  }
  if (PUBLIC_SIGNUP_LEGACY_ROLES.includes(u)) {
    return u;
  }
  return "REVIEWER";
}

/**
 * Module roles on signup: Admin Panel + APIs use `operationsRole === "admin"`.
 * Choosing legacy ADMIN also grants admin across HR / PMS / QHSE (matches seeded ops admin users).
 *
 * @param {string} legacyRole
 */
export function getModuleRolesForSignupLegacyRole(legacyRole) {
  if (legacyRole === "ADMIN") {
    return {
      operationsRole: "admin",
      hrRole: "admin",
      pmsRole: "admin",
      qhseRole: "admin",
    };
  }
  return {
    operationsRole: "viewer",
    hrRole: "viewer",
    pmsRole: "viewer",
    qhseRole: "viewer",
  };
}
