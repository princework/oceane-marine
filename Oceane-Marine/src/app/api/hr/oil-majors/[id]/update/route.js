import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import path from "path";
import fs from "fs/promises";
import { assertHrPermission } from "@/lib/auth/hrGuard";
import { notifyEdit } from "@/lib/notifications/moduleNotify";
import { sendOilMajorApprovalConfirmedNotification } from "@/lib/services/email/oilMajorApprovalNotification.js";

const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "_");

async function deleteFileIfExists(fileUrl) {
  if (!fileUrl) return;
  try {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    await fs.unlink(filePath).catch(() => {});
  } catch {
    // Ignore
  }
}

export async function PUT(req, { params }) {
  const guard = await assertHrPermission("canEdit");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const { id } = await params;
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

    // Find existing record
    const existing = await OilMajor.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Record not found" }, { status: 404 });
    }

    // Parse which existing attachments to keep (sent as JSON string of fileUrl arrays)
    let keepFileUrls = [];
    const keepAttachmentsRaw = formData.get("keepAttachments");
    if (keepAttachmentsRaw) {
      try {
        keepFileUrls = JSON.parse(keepAttachmentsRaw);
      } catch {
        keepFileUrls = [];
      }
    }

    // Determine which existing files to keep vs delete
    const oldAttachments = existing.attachments || [];
    const keptAttachments = [];
    for (const att of oldAttachments) {
      if (keepFileUrls.includes(att.fileUrl)) {
        keptAttachments.push(att);
      } else {
        // Delete the removed file from disk
        await deleteFileIfExists(att.fileUrl);
      }
    }

    // Handle new file uploads
    const newFiles = formData.getAll("attachments");
    const newAttachments = [];
    for (const file of newFiles) {
      if (file && typeof file !== "string" && file.name && file.size > 0) {
        const sanitizedCompany = sanitize(companyName.trim());
        const baseDir = path.join(process.cwd(), "public/uploads/hr/oil-majors", sanitizedCompany);
        await fs.mkdir(baseDir, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}-${sanitize(file.name)}`;
        const filePath = path.join(baseDir, fileName);
        await fs.writeFile(filePath, buffer);

        newAttachments.push({
          fileUrl: `/uploads/hr/oil-majors/${sanitizedCompany}/${fileName}`,
          originalFileName: file.name,
        });
      }
    }

    const becameApproved = existing.status !== "Approved" && status === "Approved";

    // Merge kept + new
    existing.companyName = companyName.trim();
    existing.status = status;
    existing.attachments = [...keptAttachments, ...newAttachments];
    await existing.save();

    if (becameApproved) {
      await sendOilMajorApprovalConfirmedNotification(existing.companyName);
    }

    void notifyEdit("HR", "oil-majors · update", id);
    return NextResponse.json({ data: existing }, { status: 200 });
  } catch (err) {
    console.error("Oil Major update error:", err);
    return NextResponse.json({ message: err.message || "Update failed", error: err.message }, { status: 500 });
  }
}
