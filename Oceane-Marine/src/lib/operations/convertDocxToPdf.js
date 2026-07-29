import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const libre = require("libreoffice-convert");
function convertWithLibre(buffer, format, filter) {
  return new Promise((resolve, reject) => {
    libre.convert(buffer, format, filter, (err, done) => {
      if (err) reject(err);
      else resolve(done);
    });
  });
}

const SOFFICE_CANDIDATES = [
  process.env.LIBREOFFICE_PATH,
  process.env.SOFFICE_PATH,
  "soffice",
  "libreoffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
].filter(Boolean);

async function convertWithSoffice(docxBuffer) {
  let lastError;
  for (const soffice of SOFFICE_CANDIDATES) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "compat-pdf-"));
    const docxPath = path.join(tmpDir, "compatibility.docx");
    const pdfPath = path.join(tmpDir, "compatibility.pdf");

    try {
      await fs.writeFile(docxPath, docxBuffer);
      await execFileAsync(
        soffice,
        [
          "--headless",
          "--norestore",
          "--nolockcheck",
          "--nodefault",
          "--convert-to",
          "pdf",
          "--outdir",
          tmpDir,
          docxPath,
        ],
        { timeout: 90000, windowsHide: true }
      );
      return await fs.readFile(pdfPath);
    } catch (err) {
      lastError = err;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  throw lastError ?? new Error("LibreOffice (soffice) not found");
}

async function convertWithWordCom(docxBuffer) {
  if (process.platform !== "win32") {
    throw new Error("Microsoft Word conversion is only available on Windows");
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "compat-pdf-"));
  const docxPath = path.join(tmpDir, "compatibility.docx");
  const pdfPath = path.join(tmpDir, "compatibility.pdf");

  const psScript = `
$ErrorActionPreference = "Stop"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open("${docxPath.replace(/\\/g, "\\\\")}")
  $doc.ExportAsFixedFormat("${pdfPath.replace(/\\/g, "\\\\")}", 17)
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
`;

  try {
    await fs.writeFile(docxPath, docxBuffer);
    await execFileAsync(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", psScript],
      { timeout: 120000, windowsHide: true }
    );
    return await fs.readFile(pdfPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Convert a filled Compatibility .docx buffer to PDF (same output as Word download).
 * Tries LibreOffice first, then Microsoft Word on Windows.
 * @param {Buffer} docxBuffer
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdf(docxBuffer) {
  try {
    const pdf = await convertWithLibre(docxBuffer, ".pdf", undefined);
    return Buffer.from(pdf);
  } catch {
    try {
      return await convertWithSoffice(docxBuffer);
    } catch {
      return convertWithWordCom(docxBuffer);
    }
  }
}
