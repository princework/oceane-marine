import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import { notifyEdit, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const doc = await RiskAssessment.findById(id);
    if (!doc) {
      return NextResponse.json(
        { success: false, error: "Risk assessment not found" },
        { status: 404 }
      );
    }
    const filePath = doc.filePath;
    await RiskAssessment.findByIdAndDelete(id);
    if (filePath) {
      const cwd = process.cwd();
      const toAbs = (p) => (path.isAbsolute(p) ? p : path.join(cwd, p));
      let fullPath = toAbs(filePath);
      if (!fs.existsSync(fullPath)) {
        const alt = String(filePath).replace("risk-assessment", "risk-assesment");
        fullPath = toAbs(alt);
      }
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      }
    }
    void notifyDelete("QHSE", "risk-assessment", id);
    return NextResponse.json(
      { success: true, message: "Risk assessment deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete risk assessment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
