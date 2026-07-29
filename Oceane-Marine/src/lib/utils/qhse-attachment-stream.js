import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONTENT_TYPE_MAP = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const KNOWN_EXTENSIONS = new Set(
  Object.keys(CONTENT_TYPE_MAP).map((e) => e.slice(1))
);

/** Earlier QHSE uploads sanitized "." in extensions to "_" (e.g. file_pdf). Recover the real name. */
export function recoverMangledExtension(name) {
  if (!name || typeof name !== "string") return name;
  if (path.extname(name)) return name;
  const m = /_([a-zA-Z0-9]{2,5})$/.exec(name);
  if (m && KNOWN_EXTENSIONS.has(m[1].toLowerCase())) {
    return `${name.slice(0, m.index)}.${m[1].toLowerCase()}`;
  }
  return name;
}

/** Detect file type from magic bytes when filename has no/wrong extension. */
export function sniffContentTypeAndExt(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { ext: ".pdf", type: "application/pdf" };
  }
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return {
      ext: ".xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return { ext: ".doc", type: "application/msword" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", type: "image/jpeg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: ".png", type: "image/png" };
  }
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { ext: ".gif", type: "image/gif" };
  }
  return null;
}

/**
 * Stream a file on disk back to the browser with RFC 5987 Content-Disposition,
 * correct Content-Type (sniffed from magic bytes if needed), and a recovered
 * filename extension when the source name was mangled (e.g. `report_pdf`).
 *
 * @param {string} absolutePath
 * @param {string|null} fileNameOverride
 */
export function streamAttachmentFile(absolutePath, fileNameOverride = null) {
  const fileBuffer = fs.readFileSync(absolutePath);
  let fileName = fileNameOverride || path.basename(absolutePath);
  fileName = recoverMangledExtension(fileName);
  let fileExt = path.extname(fileName).toLowerCase();
  let contentType = CONTENT_TYPE_MAP[fileExt];
  if (!contentType) {
    const sniffed = sniffContentTypeAndExt(fileBuffer);
    if (sniffed) {
      contentType = sniffed.type;
      if (!fileExt) {
        fileName = `${fileName}${sniffed.ext}`;
        fileExt = sniffed.ext;
      }
    } else {
      contentType = "application/octet-stream";
    }
  }
  const safeAscii = fileName
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 200);
  const encoded = encodeURIComponent(fileName);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileBuffer.length),
      "Content-Disposition": `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
