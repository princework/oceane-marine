import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection.js";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import fs from "node:fs";
import path from "node:path";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyEdit } from "@/lib/notifications/moduleNotify";
import { isSameUtcDate } from "@/lib/utils/utcDate";

export async function PUT(req, { params }) {
  const guard = await assertPmsPermission("canEdit");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { message: "Missing record id" },
        { status: 400 }
      );
    }

    const existing = await WarehouseManagement.findById(id);
    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { message: "Record not found" },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let body = {};
    let attachmentFile = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      attachmentFile = formData.get("attachment");

      const getField = (name) => {
        const val = formData.get(name);
        return typeof val === "string" ? val.trim() : "";
      };

      body = {
        location: getField("location"),
        primaryFenders: Number(getField("primaryFenders") || 0),
        secondaryFenders: Number(getField("secondaryFenders") || 0),
        hoses: Number(getField("hoses") || 0),
        additionalEquipments: getField("additionalEquipments"),
        ownership: getField("ownership"),
        status: getField("status") || "NOT_COMPLETED",
        equipment: getField("equipment"),
        equipmentType: getField("equipmentType"),
        specification: getField("specification"),
        nos: Number(getField("nos")),
        startDate: getField("startDate") || undefined,
        estimatedEndDate: getField("estimatedEndDate") || undefined,
        fromLocation: getField("fromLocation"),
        stopover: getField("stopover"),
        toLocation: getField("toLocation"),
        remarks: getField("remarks"),
      };
    } else {
      body = await req.json();
    }

    if (
      !body.location ||
      !body.equipment ||
      body.nos === undefined ||
      Number(body.nos) <= 0 ||
      !body.ownership
    ) {
      return NextResponse.json(
        { message: "Invalid payload — location, equipment, nos, and ownership are required" },
        { status: 400 }
      );
    }

    // Handle new attachment
    let newAttachments = [...(existing.attachments || [])];

    if (attachmentFile && typeof attachmentFile !== "string") {
      const ALLOWED_EXT = new Set([
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png",
      ]);
      const MAX_SIZE = 25 * 1024 * 1024;

      if (attachmentFile.size > MAX_SIZE) {
        return NextResponse.json(
          { message: "File exceeds 25MB limit" },
          { status: 400 }
        );
      }

      const ext = path.extname(attachmentFile.name || "").toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          { message: "Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG" },
          { status: 400 }
        );
      }

      const uploadDir = path.join(process.cwd(), "uploads", "warehouse-management");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const safeFileName = (attachmentFile.name || "file").replace(/\s+/g, "_");
      const fileName = `${timestamp}-${safeFileName}`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      newAttachments.push({
        filePath,
        fileName: attachmentFile.name || safeFileName,
      });
    }

    // Update fields
    existing.location = String(body.location).trim();
    existing.equipment = body.equipment;
    existing.equipmentType = body.equipmentType || "";
    existing.specification = body.specification || "";
    existing.primaryFenders = Number(body.primaryFenders) || 0;
    existing.secondaryFenders = Number(body.secondaryFenders) || 0;
    existing.hoses = Number(body.hoses) || 0;
    existing.additionalEquipments = body.additionalEquipments || "";
    existing.ownership = body.ownership;
    existing.status = body.status || "NOT_COMPLETED";
    if (existing.status === "COMPLETED") {
      existing.pmsWarehouseEndOverdueEmailSentForEstimatedEndDate = undefined;
    }
    existing.nos = Number(body.nos);
    existing.fromLocation = body.fromLocation || "";
    existing.stopover = body.stopover || "";
    existing.toLocation = body.toLocation || "";
    existing.remarks = body.remarks || "";
    existing.attachments = newAttachments;

    if (body.startDate) existing.startDate = new Date(body.startDate);
    else existing.startDate = undefined;

    const prevEstimatedEnd = existing.estimatedEndDate;
    if (body.estimatedEndDate) existing.estimatedEndDate = new Date(body.estimatedEndDate);
    else existing.estimatedEndDate = undefined;

    if (!isSameUtcDate(prevEstimatedEnd, existing.estimatedEndDate)) {
      existing.pmsWarehouseEndOverdueEmailSentForEstimatedEndDate = undefined;
    }

    await existing.save();

    void notifyEdit(NOTIFICATION_MODULES.PMS, "Warehouse Management", existing._id);

    return NextResponse.json({ success: true, data: existing });
  } catch (error) {
    console.error("Warehouse update error:", error);
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
}
