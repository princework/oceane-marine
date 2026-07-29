import path from "node:path";
import { promises as fs } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildCompatibilityDocumentValues } from "@/lib/operations/compatibilityDocumentValues";
import {
  COMPATIBILITY_PDF_FIELDS,
  COMPATIBILITY_PDF_TEMPLATE,
} from "@/lib/operations/compatibilityPdfOverlayFields";

function drawField(page, font, text, field) {
  let size = field.size ?? 8;
  const maxWidth = field.maxWidth ?? 120;
  let width = font.widthOfTextAtSize(text, size);

  while (width > maxWidth && size > 4.5) {
    size -= 0.5;
    width = font.widthOfTextAtSize(text, size);
  }

  page.drawText(text, {
    x: field.x,
    y: field.y,
    size,
    font,
    color: rgb(0, 0, 0),
    maxWidth,
  });
}

/**
 * Fill Compatibility.pdf template by drawing record values at calibrated positions.
 * Uses the flat PDF template (same visual layout) — reliable on server without LibreOffice layout issues.
 * @param {object} doc - Compatibility lean document from MongoDB
 * @returns {Promise<Buffer>}
 */
export async function generateCompatibilityPdf(doc) {
  const templatePath = path.join(process.cwd(), COMPATIBILITY_PDF_TEMPLATE);
  const templateBytes = await fs.readFile(templatePath);

  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const values = buildCompatibilityDocumentValues(doc);

  for (const field of COMPATIBILITY_PDF_FIELDS) {
    const raw = values[field.tag];
    const text = raw == null ? "" : String(raw).trim();
    if (!text) continue;

    const page = pages[field.page];
    if (!page) continue;

    drawField(page, font, text, field);
  }

  return Buffer.from(await pdfDoc.save());
}
