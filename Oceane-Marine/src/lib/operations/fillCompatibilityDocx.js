import path from "path";
import { promises as fs } from "fs";
import JSZip from "jszip";
import { buildCompatibilityDocumentValues } from "@/lib/operations/compatibilityDocumentValues";

const TEMPLATE_PATH = "public/templates/Compatibility.template.docx";

/** Escape a value for inclusion in OOXML document.xml. */
function xmlEscape(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Load Compatibility.template.docx, replace {{TAG}} placeholders, return .docx buffer.
 * @param {object} doc - Compatibility lean document from MongoDB
 */
export async function fillCompatibilityDocx(doc) {
  const templateAbsPath = path.join(process.cwd(), TEMPLATE_PATH);
  const templateBuffer = await fs.readFile(templateAbsPath);

  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file("word/document.xml").async("string");

  const values = buildCompatibilityDocumentValues(doc);
  for (const [tag, value] of Object.entries(values)) {
    if (tag === "YEAR" || tag === "LOCATION") continue;
    xml = xml.split(`{{${tag}}}`).join(xmlEscape(value));
  }

  zip.file("word/document.xml", xml);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}
