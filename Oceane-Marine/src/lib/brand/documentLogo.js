import fs from "node:fs";
import path from "node:path";

/** Public URL for HTML/Puppeteer templates */
export const DOCUMENT_LOGO_PUBLIC_SRC = "/image/image.png";

/** Absolute filesystem path to the brand logo used in generated documents */
export function getDocumentLogoPath() {
  return path.join(process.cwd(), "public/image/image.png");
}

/** Read logo bytes for PDF/DOCX generation */
export function readDocumentLogo() {
  return fs.readFileSync(getDocumentLogoPath());
}
