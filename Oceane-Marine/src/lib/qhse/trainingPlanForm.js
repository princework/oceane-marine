import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

const MONTH_PAIRS = ["Jan-Feb", "Mar-Apr", "May-Jun", "Jul-Aug", "Sep-Oct", "Nov-Dec"];
const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"]);
const MAX_SIZE = 25 * 1024 * 1024;

/**
 * Parse planItems + optional month-pair uploads from multipart form (create / update).
 * @returns {{ planItems: object[], monthPairFiles: Record<string, { filePath, fileName }>, planYear: number }}
 */
export async function parseTrainingPlanFormData(formData) {
  const planItemsStr = formData.get("planItems");
  if (!planItemsStr) {
    throw new Error("planItems is required");
  }

  const planItems = JSON.parse(String(planItemsStr));
  if (!Array.isArray(planItems) || planItems.length === 0) {
    throw new Error("planItems array is required");
  }

  const years = planItems.map((item) => new Date(item.plannedDate).getFullYear());
  if (new Set(years).size > 1) {
    throw new Error("All plan items must belong to the same year");
  }

  const planYear = years[0];
  const monthPairFiles = {};

  for (const monthPair of MONTH_PAIRS) {
    const file = formData.get(`monthPairFile_${monthPair}`);
    if (file && typeof file !== "string" && file.name && file.size > 0) {
      if (file.size > MAX_SIZE) {
        throw new Error(`${monthPair} file exceeds 25MB limit`);
      }
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        throw new Error(`Invalid file type for ${monthPair}`);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-038",
        date: new Date(planYear, 0, 1),
        title: monthPair,
        fileType: "documents",
        fileName: file.name,
        buffer,
      });
      monthPairFiles[monthPair] = { filePath, fileName: file.name };
    }
  }

  return { planItems, monthPairFiles, planYear };
}
