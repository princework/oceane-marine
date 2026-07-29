// Build a placeholder version of Compatibility.docx by injecting {{TAG}} tokens
// into the verified value boxes (both DrawingML Choice + VML Fallback copies).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

// scripts/ -> project root
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/templates/Compatibility.docx");
const OUT = path.join(ROOT, "public/templates/Compatibility.template.docx");

// box index (in txbxContent pair order) -> placeholder tag
const MAP = {
  0: "JOB_REF",
  2: "SS_NAME", 1: "STBL_NAME",
  5: "POINT_A", 20: "POINT_B", 19: "POINT_C",
  13: "SS_MAXFB", 12: "SS_MINFB", 10: "STBL_MAXFB", 9: "STBL_MINFB",
  7: "HOSE_LEN",
  23: "SS_DWT", 27: "SS_BEAM", 31: "SS_DISP", 36: "SS_DRAFT",
  22: "STBL_DWT", 25: "STBL_BEAM", 30: "STBL_DISP", 34: "STBL_DRAFT",
  39: "EDC", 41: "STBL_MASS", 43: "SS_MASS", 45: "VDISP_STBL", 46: "VDISP_SS",
  38: "CVD", 40: "E_CALM", 42: "E_MOD", 44: "E_ROUGH",
  47: "F_CALM", 49: "F_MOD", 52: "F_ROUGH",
};

function filledParagraph(tag) {
  return (
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>` +
    `<w:rPr><w:b/><w:bCs/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="en-US"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:bCs/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="en-US"/></w:rPr>` +
    `<w:t xml:space="preserve">{{${tag}}}</w:t></w:r></w:p>`
  );
}

/**
 * Remove the internal top/bottom padding of a value box and vertically centre it,
 * so short boxes (≈14.75pt) no longer clip the text. Targeted via the unique
 * placeholder so only value boxes are touched (labels keep their original layout).
 */
function fitBoxToText(xml, tag) {
  const tx = `\\{\\{${tag}\\}\\}`;

  // DrawingML (Choice): <wps:bodyPr ...> appears right after the box's </wps:txbx>
  xml = xml.replace(
    new RegExp(`(${tx}[\\s\\S]*?</wps:txbx>)(<wps:bodyPr\\b[^>]*?>)`),
    (full, head, bodyPr) => {
      let bp = bodyPr;
      bp = /\stIns="/.test(bp)
        ? bp.replace(/tIns="\d+"/, 'tIns="0"')
        : bp.replace("<wps:bodyPr", '<wps:bodyPr tIns="0"');
      bp = /\sbIns="/.test(bp)
        ? bp.replace(/bIns="\d+"/, 'bIns="0"')
        : bp.replace("<wps:bodyPr", '<wps:bodyPr bIns="0"');
      bp = /\sanchor="/.test(bp)
        ? bp.replace(/anchor="[^"]*"/, 'anchor="ctr"')
        : bp.replace("<wps:bodyPr", '<wps:bodyPr anchor="ctr"');
      return head + bp;
    }
  );

  // VML (Fallback): <v:textbox ...> wraps the box's txbxContent
  xml = xml.replace(
    new RegExp(`(<v:textbox\\b)([^>]*?)(>\\s*<w:txbxContent>[\\s\\S]*?${tx})`),
    (full, open, attrs, tail) => {
      let at = attrs;
      at = /\sinset="/.test(at)
        ? at.replace(/inset="[^"]*"/, 'inset="0,0,0,0"')
        : `${at} inset="0,0,0,0"`;
      // VML vertical-centre flag lives in the style attribute
      if (/\sstyle="/.test(at)) {
        at = /v-text-anchor:/.test(at)
          ? at.replace(/v-text-anchor:[^;"']*/, "v-text-anchor:middle")
          : at.replace(/style="/, 'style="v-text-anchor:middle;');
      } else {
        at = `${at} style="v-text-anchor:middle"`;
      }
      return open + at + tail;
    }
  );

  return xml;
}

const buf = fs.readFileSync(SRC);
const zip = await JSZip.loadAsync(buf);
let xml = await zip.file("word/document.xml").async("string");

// Each value box has TWO txbxContent blocks (Choice then Fallback) in document order.
const re = /<w:txbxContent>([\s\S]*?)<\/w:txbxContent>/g;
let blockIdx = 0;
let injected = 0;
xml = xml.replace(re, (full, inner) => {
  const boxIdx = Math.floor(blockIdx / 2); // pair index
  blockIdx++;
  const tag = MAP[boxIdx];
  if (!tag) return full;
  injected++;
  return `<w:txbxContent>${filledParagraph(tag)}</w:txbxContent>`;
});

console.log("txbxContent blocks injected:", injected, "(expected", Object.keys(MAP).length * 2, ")");

// Shrink internal padding + vertically centre each value box so text never clips.
for (const tag of Object.values(MAP)) {
  xml = fitBoxToText(xml, tag);
}

zip.file("word/document.xml", xml);
const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(OUT, out);
console.log("Wrote", OUT, "(", out.length, "bytes )");

// Verify placeholders present
const verifyZip = await JSZip.loadAsync(fs.readFileSync(OUT));
const vxml = await verifyZip.file("word/document.xml").async("string");
const found = [...new Set([...vxml.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]))].sort();
console.log("Placeholders found in output:", found.length);
console.log(found.join(", "));
