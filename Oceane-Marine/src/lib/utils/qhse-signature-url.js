/**
 * Resolve stored signature values to a browser-safe img `src`.
 * Supports: data URLs, http(s), `/signature/{module}/{submodule}/...` (public static), legacy `uploads/...` (API), raw base64.
 *
 * Absolute URLs under `/signature/` or `/api/qhse/file/` are returned as-is so the image loads from the
 * same host that stored the file (stripping to pathname-only breaks when the admin app origin differs).
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function resolveQhseSignatureImageSrc(value) {
  if (value == null || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;
  const normalized = trimmed.replace(/\\/g, "/");
  if (normalized.startsWith("public/signature/")) {
    return `/${normalized.slice("public/".length)}`;
  }
  if (normalized.startsWith("/public/signature/")) {
    return normalized.replace(/^\/public/, "");
  }
  if (normalized.startsWith("//")) {
    try {
      const absolutized = `https:${normalized}`;
      const u = new URL(absolutized);
      if (
        u.pathname.startsWith("/signature/") ||
        u.pathname.startsWith("/api/qhse/file/")
      ) {
        return absolutized;
      }
    } catch {
      /* ignore */
    }
    return `https:${normalized}`;
  }
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const u = new URL(normalized);
      if (
        u.pathname.startsWith("/signature/") ||
        u.pathname.startsWith("/api/qhse/file/")
      ) {
        return normalized;
      }
    } catch {
      /* ignore */
    }
    return normalized;
  }
  if (normalized.startsWith("/signature/") || normalized.startsWith("signature/")) {
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
  if (normalized.startsWith("uploads/") || normalized.startsWith("/uploads/")) {
    const path = normalized.replace(/^\/+/, "");
    return `/api/qhse/file/${path}`;
  }
  if (/^[A-Za-z0-9+/=]{50,}$/.test(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }
  return null;
}

/** Same as {@link resolveQhseSignatureImageSrc}; generic name for app-wide use. */
export function resolveSignatureImageSrc(value) {
  return resolveQhseSignatureImageSrc(value);
}

/** True when the value can be shown as a signature image (img src). */
export function isResolvableSignatureImage(value) {
  return resolveQhseSignatureImageSrc(value) != null;
}
