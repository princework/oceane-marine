import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import DrillPlan from "@/lib/mongodb/models/qhse-drill/DrillPlan";
import path from "node:path";
import { saveQhseFile } from "@/lib/utils/qhse-file-storage";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const getQuarterFromDate = (date) => {
  const d = new Date(date);
  const m = d.getMonth();
  return QUARTERS[Math.floor(m / 3)];
};

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    if (year) {
      const plan = await DrillPlan.findOne({
        year: Number.parseInt(year, 10),
        "planItems.status": "Approved",
      }).sort({ createdAt: -1 });

      if (!plan) {
        return NextResponse.json(
          { success: false, error: "No approved drill plan found for this year" },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: plan });
    } else {
      const plans = await DrillPlan.find({
        "planItems.status": "Approved",
      }).select("year");
      const years = [...new Set(plans.map((p) => p.year))].sort((a, b) => b - a);

      return NextResponse.json({ success: true, data: years });
    }
  } catch (error) {
    console.error("Get Drill Plan Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const formData = await req.formData();

    const planItemsStr = formData.get("planItems");
    const yearStr = formData.get("year");

    if (!planItemsStr || !yearStr) {
      return NextResponse.json(
        { success: false, error: "planItems and year are required" },
        { status: 400 }
      );
    }

    const planItems = JSON.parse(planItemsStr);
    const year = Number.parseInt(yearStr, 10);

    if (!Array.isArray(planItems) || planItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "planItems array is required" },
        { status: 400 }
      );
    }

    const years = planItems.map(item =>
      new Date(item.plannedDate).getFullYear()
    );
    if (new Set(years).size > 1) {
      return NextResponse.json(
        { success: false, error: "All plan items must belong to the same year" },
        { status: 400 }
      );
    }

    const normalizedPlanItems = planItems.map((item) => {
      const plannedDate = new Date(item.plannedDate);
      return {
        plannedDate,
        quarter: item.quarter || getQuarterFromDate(plannedDate),
        topic: item.topic?.trim(),
        instructor: item.instructor?.trim(),
        description: item.description?.trim(),
        status: "Approved", // Drill matrix is saved as approved so it shows in list/report immediately
      };
    });

    const quarterFiles = {};
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"]);
    const MAX_SIZE = 25 * 1024 * 1024;

    for (const quarter of quarters) {
      const file = formData.get(`quarterFile_${quarter}`);

      if (file && typeof file !== "string" && file.name && file.size > 0) {
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { success: false, error: `${quarter} file exceeds 25MB limit` },
            { status: 400 }
          );
        }

        const ext = path.extname(file.name).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) {
          return NextResponse.json(
            { success: false, error: `Invalid file type for ${quarter}` },
            { status: 400 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filePath = await saveQhseFile({
          formCode: "QAF-OFD-040",
          date: new Date(year, 0, 1),
          title: quarter,
          fileType: "documents",
          fileName: file.name,
          buffer,
        });

        quarterFiles[quarter] = {
          filePath,
          fileName: file.name,
        };
      }
    }

    const DrillPlanModel = DrillPlan || (await import("@/lib/mongodb/models/qhse-drill/DrillPlan")).default;

    const planData = {
      year,
      planItems: normalizedPlanItems,
    };

    if (Object.keys(quarterFiles).length > 0) {
      planData.quarterFiles = quarterFiles;
    }

    const newPlan = await DrillPlanModel.create(planData);

    return NextResponse.json(
      { success: true, data: newPlan },
      { status: 201 }
    );
  } catch (error) {
    console.error("Drill Plan Creation Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
