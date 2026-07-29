import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import puppeteer from "puppeteer";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import StsQuotationForm from "@/lib/mongodb/models/operations-form-checklist/StsQuotationForm";
import { getSignatureAbsolutePathForRead } from "@/lib/utils/signature-storage";
import {
  buildDocumentHtml030,
  buildDocumentHtml030B,
  buildDocumentHtmlPOAC,
  getFormNoLineForPdf,
} from "@/app/operations/sts-operations/new/form-checklist/quotations/sts-form/documentTemplate";

export const maxDuration = 60;

function escapeForHtml(s) {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function defaultFormNoForQuotation(formType) {
  if (formType === "OPS-OFD-030B") return "OPS-OFD-030B";
  if (formType === "POAC") return "Form No. OPS-OFD-30A / Rev 1.2 / Issue Date: 20 Aug 2023";
  return "Form No. OPS-OFD-30 / Rev 1.1 / Issue Date: 20 Aug 2023";
}

/**
 * Build HTML + footer on the server from MongoDB so signature files are read on the same
 * machine as Puppeteer (fixes missing images when the client sent HTML with unresolved /signature/ URLs).
 */
async function resolveQuotationHtmlForPdf(body) {
  const quotationId = body?.quotationId;
  const clientHtml = body?.html;
  const clientFormNoLine = body?.formNoLine;

  if (quotationId != null && String(quotationId).trim() !== "") {
    const id = String(quotationId).trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: "Invalid quotationId", status: 400 };
    }
    await connectDB();
    const doc = await StsQuotationForm.findById(id).lean();
    if (!doc) {
      return { error: "Quotation not found", status: 404 };
    }
    const defaultNo = defaultFormNoForQuotation(doc.formType);
    const formNoLine = getFormNoLineForPdf(doc, defaultNo);
    let html;
    if (doc.formType === "OPS-OFD-030B") html = buildDocumentHtml030B(doc);
    else if (doc.formType === "POAC") html = buildDocumentHtmlPOAC(doc);
    else html = buildDocumentHtml030(doc);
    return { html, formNoLine };
  }

  if (clientHtml && typeof clientHtml === "string") {
    return { html: clientHtml, formNoLine: clientFormNoLine ?? "" };
  }

  return { error: "Provide quotationId or html", status: 400 };
}

/** Inline absolute-rooted asset URLs (`src="/foo/bar.png"`) as data: URLs. */
async function inlinePublicAssets(html) {
  const publicDir = path.join(process.cwd(), "public");
  const cache = new Map();
  const re = /(src|href)\s*=\s*"\/([^"#?]+\.(?:png|jpe?g|gif|svg|webp))"/gi;
  const matches = [...html.matchAll(re)];
  for (const m of matches) {
    const rel = m[2];
    if (cache.has(rel)) continue;
    cache.set(rel, null);
    try {
      const filePath = path.join(publicDir, rel);
      if (!filePath.startsWith(publicDir)) continue;
      const buf = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_BY_EXT[ext] || "application/octet-stream";
      cache.set(rel, `data:${mime};base64,${buf.toString("base64")}`);
    } catch {
      // ignored
    }
  }
  return html.replace(re, (full, attr, rel) => {
    const data = cache.get(rel);
    return data ? `${attr}="${data}"` : full;
  });
}

/** Remaining /signature/… URLs → data URLs (Puppeteer setContent is about:blank). */
async function inlineSignaturePublicUrls(html) {
  const re = /src="(\/signature\/[^"]+)"/g;
  const paths = [...new Set([...html.matchAll(re)].map((m) => m[1]))];
  const dataByPath = new Map();
  for (const urlPath of paths) {
    const abs = getSignatureAbsolutePathForRead(urlPath);
    if (!abs) continue;
    try {
      const buf = await fs.readFile(abs);
      const ext = path.extname(abs).toLowerCase();
      const mime = MIME_BY_EXT[ext] || "image/png";
      dataByPath.set(urlPath, `data:${mime};base64,${buf.toString("base64")}`);
    } catch (e) {
      console.warn("STS quotation PDF: could not read signature file", urlPath, e?.message || e);
    }
  }
  return html.replace(re, (full, p1) => {
    const data = dataByPath.get(p1);
    return data ? `src="${data}"` : full;
  });
}

export async function POST(req) {
  let browser;
  try {
    const body = await req.json();
    const resolved = await resolveQuotationHtmlForPdf(body);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status ?? 400 }
      );
    }
    const { html, formNoLine } = resolved;

    const footerText = formNoLine != null ? escapeForHtml(String(formNoLine)) : "";
    let htmlForPdf = await inlinePublicAssets(html);
    htmlForPdf = await inlineSignaturePublicUrls(htmlForPdf);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();

    await page.setContent(htmlForPdf, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "22mm", right: "10mm", bottom: "18mm", left: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%;height:12mm;display:flex;align-items:center;padding:0;box-sizing:border-box;">
          <div style="display:inline-flex;align-items:center;justify-content:center;min-width:14mm;height:12mm;background:#1e3a5f;color:#fff;font-size:12pt;font-weight:bold;font-family:Arial,sans-serif;border-radius:0 8px 8px 0;padding:0 10px 0 12px;">
            <span class="pageNumber"></span>
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%;height:12mm;display:flex;align-items:center;justify-content:flex-end;padding:0 12mm;box-sizing:border-box;background:#1e3a5f;color:#fff;font-size:9pt;font-family:Arial,sans-serif;">
          <span>${footerText}</span>
        </div>
      `,
    });

    await browser.close();
    browser = null;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="quotation.pdf"',
      },
    });
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    console.error("STS quotation PDF generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
