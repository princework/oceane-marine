import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { sendOilMajorApprovalConfirmedNotification } from "@/lib/services/email/oilMajorApprovalNotification.js";

const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "_");

export async function POST(req) {
  const guard = await assertHrPermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const formData = await req.formData();

    const companyName = formData.get("companyName");
    const status = formData.get("status");

    // Validate required fields
    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ message: "Company Name is required" }, { status: 400 });
    }
    if (!status || !["Approved", "Counterparty STS service provider", "In Progress"].includes(status)) {
      return NextResponse.json({ message: "Valid status is required" }, { status: 400 });
    }

    // Handle multiple file uploads
    const files = formData.getAll("attachments");
    const attachments = [];

    for (const file of files) {
      if (file && typeof file !== "string" && file.name && file.size > 0) {
        const sanitizedCompany = sanitize(companyName.trim());
        const baseDir = path.join(process.cwd(), "public/uploads/hr/oil-majors", sanitizedCompany);
        await fs.mkdir(baseDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${sanitize(file.name)}`;
        const filePath = path.join(baseDir, fileName);
        await fs.writeFile(filePath, buffer);

        attachments.push({
          fileUrl: `/uploads/hr/oil-majors/${sanitizedCompany}/${fileName}`,
          originalFileName: file.name,
        });
      }
    }

    const record = await OilMajor.create({
      companyName: companyName.trim(),
      status,
      attachments,
    });

    if (status === "Approved") {
      // Await so the send finishes before the handler returns (serverless / dev can drop void promises).
      await sendOilMajorApprovalConfirmedNotification(record.companyName);
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("Oil Major creation error:", err);
    return NextResponse.json({ message: err.message || "Creation failed", error: err.message }, { status: 500 });
  }
}
