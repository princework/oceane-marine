/**
 * One-time / idempotent: adds notifyOperationsEdit / notifyOperationsDelete
 * to src/app/api/operations route handlers.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPS_API = path.join(__dirname, "../src/app/api/operations");

const IMPORT_LINE = `import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";`;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "route.js") out.push(p);
  }
  return out;
}

function norm(p) {
  return p.replace(/\\/g, "/");
}

function submoduleFromPath(fullPath) {
  const rel = norm(fullPath).split("api/operations/")[1] || "";
  if (rel.startsWith("sts/")) return "STS Operations";
  if (rel.includes("compatibility")) return "Compatibility";
  if (rel.includes("form-checklist/sts-quotation-form")) return "STS Quotation";
  if (rel.includes("form-checklist/manual/form-codes")) return "Manual Form Codes";
  if (rel.includes("form-checklist/manual")) return "Manual Form";
  if (rel.includes("form-checklist/jpo")) return "JPO";
  if (rel.includes("form-checklist/inspection-checklist")) return "Inspection Checklist";
  if (rel.includes("form-checklist/quotation")) return "Quotation";
  const m = rel.match(/sts-checklist\/([^/]+)/);
  if (m) {
    const seg = m[1];
    if (seg === "declaration-of-sea" || seg === "ops-ofd-005e") return "OPS-OFD-005E";
    return seg.toUpperCase();
  }
  return "Operations";
}

function ensureImport(src) {
  if (src.includes("operationsNotified")) return src;
  if (!src.includes("notifyOperationsEdit") && !src.includes("notifyOperationsDelete")) {
    return src;
  }
  const lines = src.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].startsWith("import ")) i++;
  lines.splice(i, 0, IMPORT_LINE);
  return lines.join("\n");
}

function lastUpdatedVar(tryBody) {
  const re =
    /const (\w+) = await [\w.]+\.(findByIdAndUpdate|findOneAndUpdate|create)\(/g;
  let m;
  let last = null;
  while ((m = re.exec(tryBody)) !== null) last = m[1];
  return last;
}

function patchPut(src, fullPath, useIdParam) {
  if (!src.includes("export async function PUT")) return src;
  if (src.includes("notifyOperationsEdit")) return src;
  const sub = submoduleFromPath(fullPath);
  const parts = src.split("export async function PUT");
  if (parts.length < 2) return src;
  let tail = parts[1];
  const nextFn = tail.search(/\nexport async function [A-Za-z]/);
  if (nextFn !== -1) tail = tail.slice(0, nextFn);
  const catchSplit = tail.split(/\n  } catch/);
  const tryTail = catchSplit[0];
  const lastRet = tryTail.lastIndexOf("\n    return NextResponse.json(");
  if (lastRet === -1) return src;
  let recordExpr = "id";
  if (!useIdParam) {
    const v = lastUpdatedVar(tryTail);
    recordExpr = v ? `${v}._id` : "id";
  }
  const inject = `\n    void notifyOperationsEdit("${sub}", ${recordExpr});`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  const rebuilt =
    parts[0] +
    "export async function PUT" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "");
  return rebuilt;
}

function patchDelete(src, fullPath) {
  if (!src.includes("export async function DELETE")) return src;
  if (src.includes("notifyOperationsDelete")) return src;
  const sub = submoduleFromPath(fullPath);
  const parts = src.split("export async function DELETE");
  if (parts.length < 2) return src;
  let tail = parts[1];
  const nextFn = tail.search(/\nexport async function [A-Za-z]/);
  if (nextFn !== -1) tail = tail.slice(0, nextFn);
  const catchSplit = tail.split(/\n  } catch/);
  const tryTail = catchSplit[0];
  const lastRet = tryTail.lastIndexOf("\n    return NextResponse.json(");
  if (lastRet === -1) return src;
  const inject = `\n    void notifyOperationsDelete("${sub}", id);`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  const rebuilt =
    parts[0] +
    "export async function DELETE" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "");
  return rebuilt;
}

function patchPostUpdate(src, fullPath) {
  if (!fullPath.includes(`${path.sep}update${path.sep}route.js`)) return src;
  if (!src.includes("export async function POST")) return src;
  if (src.includes("notifyOperationsEdit")) return src;
  const sub = submoduleFromPath(fullPath);
  const parts = src.split("export async function POST");
  if (parts.length < 2) return src;
  let tail = parts[1];
  const nextFn = tail.search(/\nexport async function [A-Za-z]/);
  if (nextFn !== -1) tail = tail.slice(0, nextFn);
  const catchSplit = tail.split(/\n  } catch/);
  const tryTail = catchSplit[0];
  const lastRet = tryTail.lastIndexOf("\n    return NextResponse.json(");
  if (lastRet === -1) return src;
  const v = lastUpdatedVar(tryTail);
  const recordExpr = v ? `${v}._id` : "id";
  const inject = `\n    void notifyOperationsEdit("${sub}", ${recordExpr});`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  const rebuilt =
    parts[0] +
    "export async function POST" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "");
  return rebuilt;
}

function shouldSkip(rel) {
  if (rel.includes("/list/route.js")) return true;
  if (rel.includes("/create/route.js")) return true;
  if (rel.includes("/versions/")) return true;
  if (rel.includes("/generate-ref/")) return true;
  if (rel.includes("/linked-forms/")) return true;
  if (rel.includes("/pre-sts-docs/")) return true;
  if (rel.includes("/status/route.js")) return true;
  return false;
}

function useIdParamForPut(rel) {
  return rel.includes("[id]") && !rel.includes("[formPath]");
}

const files = walk(OPS_API);
let changed = 0;

for (const f of files) {
  const rel = norm(path.relative(OPS_API, f));
  if (shouldSkip(rel)) continue;

  let src = fs.readFileSync(f, "utf8");
  const orig = src;

  if (src.includes("export async function DELETE")) {
    src = patchDelete(src, f);
  }
  if (src.includes("export async function PUT")) {
    src = patchPut(src, f, useIdParamForPut(rel));
  }
  if (f.includes(`${path.sep}update${path.sep}route.js`)) {
    src = patchPostUpdate(src, f);
  }

  if (src !== orig) {
    src = ensureImport(src);
    fs.writeFileSync(f, src, "utf8");
    changed++;
    console.log("patched", rel);
  }
}

console.log("done, files changed:", changed);
