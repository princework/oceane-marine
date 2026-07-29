/**
 * Force-download a file in the current tab without navigating away or opening
 * a new tab. Routes through `/api/files/download`, which always responds with
 * `Content-Disposition: attachment`, so browsers download in place regardless
 * of the underlying file's content type or origin.
 *
 * @param {string} url - File URL or `/uploads/...` path served by the app.
 * @param {string} [filename] - Optional suggested filename for the download.
 */
/** Normalize stored paths (e.g. uploads/QHSE/...) to a URL-safe app path (/uploads/...). */
export function normalizeUploadUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

export function downloadFileFromUrl(url, filename) {
  if (!url || typeof window === "undefined") return;
  const normalized = normalizeUploadUrl(url);
  const suggestedName = filename || guessFilename(normalized || url);
  const downloadHref = buildDownloadHref(normalized || url, suggestedName);
  if (!downloadHref) {
    window.location.assign(normalized || url);
    return;
  }
  triggerAnchorDownload(downloadHref, suggestedName);
}

/**
 * Open a file URL in a new tab for inline viewing (PDF preview, image, etc.).
 * Use this for "view" / eye-icon buttons.
 *
 * @param {string} url - File URL or `/uploads/...` path served by the app.
 */
export function viewFileInNewTab(url) {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function guessFilename(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "download");
  } catch {
    return url.split("/").pop()?.split("?")[0] || "download";
  }
}

function buildDownloadHref(url, suggestedName) {
  try {
    const params = new URLSearchParams();
    const normalized = normalizeUploadUrl(url);
    const pathOrUrl = normalized || url;
    if (pathOrUrl.startsWith("/")) {
      params.set("path", pathOrUrl);
    } else {
      let parsed;
      try {
        parsed = new URL(pathOrUrl, window.location.origin);
      } catch {
        return null;
      }
      if (parsed.origin === window.location.origin) {
        params.set("path", parsed.pathname + parsed.search);
      } else if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        params.set("url", parsed.toString());
      } else {
        return null;
      }
    }
    if (suggestedName) params.set("name", suggestedName);
    return `/api/files/download?${params.toString()}`;
  } catch {
    return null;
  }
}

function triggerAnchorDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || "";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
