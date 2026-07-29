/**
 * Set-Cookie suffix for `access_token` (login/logout must stay in sync).
 *
 * - Default: `Secure` only when NODE_ENV === "production" (legacy behaviour).
 * - Override with AUTH_COOKIE_SECURE:
 *   - "true"  → always add Secure (use behind HTTPS / reverse proxy TLS)
 *   - "false" → never add Secure (plain HTTP, e.g. IP:3000 testing)
 *   - unset   → production → Secure; dev → no Secure
 */
export function accessTokenCookieSecureSuffix() {
  const raw = process.env.AUTH_COOKIE_SECURE;
  if (raw === "true") {
    return "Secure";
  }
  if (raw === "false") {
    return "";
  }
  return process.env.NODE_ENV === "production" ? "Secure" : "";
}

/**
 * Single source of truth for `access_token` Set-Cookie (login + logout).
 * All attributes must match when setting vs clearing or the browser will not remove the cookie.
 *
 * @param {string} tokenValue - JWT, or empty string to clear
 * @param {number} maxAgeSec - 0 clears the cookie
 */
export function buildAccessTokenCookieHeader(tokenValue, maxAgeSec) {
  const secureSeg = accessTokenCookieSecureSuffix();
  const secureTail = secureSeg ? `; ${secureSeg}` : "";
  const maxAgePart =
    maxAgeSec === 0 ? "Max-Age=0" : `Max-Age=${maxAgeSec}`;
  return `access_token=${tokenValue}; HttpOnly; Path=/; ${maxAgePart}; SameSite=Lax${secureTail}`;
}
