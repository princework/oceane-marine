/**
 * Usage: node scripts/inject-module-notifications.mjs <MODULE_LABEL> <API_FOLDER>
 * Example: node scripts/inject-module-notifications.mjs QHSE qhse
 * Example: node scripts/inject-module-notifications.mjs HR hr
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODULE_LABEL = process.argv[2] || "QHSE";
const API_FOLDER = process.argv[3] || "qhse";
const API_ROOT = path.join(__dirname, "../src/app/api", API_FOLDER);

const IMPORT_LINE = `import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";`;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    console.error("Missing API root:", dir);
    process.exit(1);
  }
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
  const rel = norm(fullPath).split(`api/${API_FOLDER}/`)[1] || "";
  const cleaned = rel.replace(/\/route\.js$/, "");
  const parts = cleaned.split("/").filter((p) => !p.startsWith("["));
  return parts.join(" · ") || API_FOLDER;
}

function alreadyPatched(src) {
  return (
    src.includes(`notifyEdit("${MODULE_LABEL}"`) ||
    src.includes(`notifyDelete("${MODULE_LABEL}"`)
  );
}

function ensureImport(src) {
  if (src.includes("@/lib/notifications/moduleNotify")) return src;
  if (!alreadyPatched(src)) return src;
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
  if (alreadyPatched(src)) return src;
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
  const inject = `\n    void notifyEdit("${MODULE_LABEL}", ${JSON.stringify(sub)}, ${recordExpr});`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  return (
    parts[0] +
    "export async function PUT" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "")
  );
}

function patchPatch(src, fullPath, useIdParam) {
  if (!src.includes("export async function PATCH")) return src;
  if (alreadyPatched(src)) return src;
  const sub = submoduleFromPath(fullPath);
  const parts = src.split("export async function PATCH");
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
  const inject = `\n    void notifyEdit("${MODULE_LABEL}", ${JSON.stringify(sub)}, ${recordExpr});`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  return (
    parts[0] +
    "export async function PATCH" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "")
  );
}

function patchDelete(src, fullPath) {
  if (!src.includes("export async function DELETE")) return src;
  if (alreadyPatched(src)) return src;
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
  const inject = `\n    void notifyDelete("${MODULE_LABEL}", ${JSON.stringify(sub)}, id);`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  return (
    parts[0] +
    "export async function DELETE" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "")
  );
}

function patchPostUpdate(src, fullPath) {
  if (!fullPath.includes(`${path.sep}update${path.sep}route.js`)) return src;
  if (!src.includes("export async function POST")) return src;
  if (alreadyPatched(src)) return src;
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
  const inject = `\n    void notifyEdit("${MODULE_LABEL}", ${JSON.stringify(sub)}, ${recordExpr});`;
  const patchedTry = tryTail.slice(0, lastRet) + inject + tryTail.slice(lastRet);
  return (
    parts[0] +
    "export async function POST" +
    patchedTry +
    (catchSplit.length > 1 ? "\n  } catch" + catchSplit.slice(1).join("\n  } catch") : "")
  );
}

function shouldSkip(rel) {
  if (rel.includes("/list/route.js")) return true;
  if (rel.includes("/create/route.js")) return true;
  if (rel.includes("/download/")) return true;
  if (rel.endsWith("/download/route.js")) return true;
  if (rel.includes("/stats/")) return true;
  if (rel.includes("/history/route.js")) return true;
  return false;
}

function useIdParamForPut(rel) {
  return rel.includes("[id]") && !rel.includes("[formPath]");
}

const files = walk(API_ROOT);
let changed = 0;

for (const f of files) {
  const rel = norm(path.relative(API_ROOT, f));
  if (shouldSkip(rel)) continue;

  let src = fs.readFileSync(f, "utf8");
  const orig = src;

  if (src.includes("export async function DELETE")) {
    src = patchDelete(src, f);
  }
  if (src.includes("export async function PUT")) {
    src = patchPut(src, f, useIdParamForPut(rel));
  }
  if (src.includes("export async function PATCH")) {
    src = patchPatch(src, f, useIdParamForPut(rel));
  }
  if (f.includes(`${path.sep}update${path.sep}route.js`)) {
    src = patchPostUpdate(src, f);
  }

  if (src !== orig) {
    src = ensureImport(src);
    fs.writeFileSync(f, src, "utf8");
    changed++;
    console.log("patched", norm(path.relative(path.join(__dirname, "../src/app/api"), f)));
  }
}

console.log("done", MODULE_LABEL, API_FOLDER, "files changed:", changed);
