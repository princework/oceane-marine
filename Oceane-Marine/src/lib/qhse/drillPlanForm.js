import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"]);
const MAX_SIZE = 25 * 1024 * 1024;

const getQuarterFromDate = (date) => {
  const d = new Date(date);
  const m = d.getMonth();
  return QUARTERS[Math.floor(m / 3)];
};

/**
 * Parse planItems + year + optional quarter uploads from multipart form (create / update).
 * @returns {{ planItems: object[], year: number, quarterFiles: Record<string, { filePath, fileName }> }}
 */
export async function parseDrillPlanFormData(formData) {
  const planItemsStr = formData.get("planItems");
  const yearStr = formData.get("year");

  if (!planItemsStr || !yearStr) {
    throw new Error("planItems and year are required");
  }

  const rawPlanItems = JSON.parse(String(planItemsStr));
  const year = Number.parseInt(String(yearStr), 10);

  if (!Array.isArray(rawPlanItems) || rawPlanItems.length === 0) {
    throw new Error("planItems array is required");
  }

  const years = rawPlanItems.map((item) => new Date(item.plannedDate).getFullYear());
  if (new Set(years).size > 1) {
    throw new Error("All plan items must belong to the same year");
  }

  const planItems = rawPlanItems.map((item) => {
    const plannedDate = new Date(item.plannedDate);
    return {
      plannedDate,
      quarter: item.quarter || getQuarterFromDate(plannedDate),
      topic: item.topic?.trim(),
      instructor: item.instructor?.trim(),
      description: item.description?.trim(),
    };
  });

  const quarterFiles = {};
  for (const quarter of QUARTERS) {
    const file = formData.get(`quarterFile_${quarter}`);
    if (file && typeof file !== "string" && file.name && file.size > 0) {
      if (file.size > MAX_SIZE) {
        throw new Error(`${quarter} file exceeds 25MB limit`);
      }
      const ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        throw new Error(`Invalid file type for ${quarter}`);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePath = await saveQhseFile({
        formCode: "QAF-OFD-040",
        date: new Date(year, 0, 1),
        title: quarter,
        fileType: "documents",
        fileName: file.name,
        buffer,
      });
      quarterFiles[quarter] = { filePath, fileName: file.name };
    }
  }

  return { planItems, year, quarterFiles };
}
