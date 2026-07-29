import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection.js";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import fs from "node:fs";
import path from "node:path";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyCreate } from "@/lib/notifications/moduleNotify";

export async function POST(req) {
  const guard = await assertPmsPermission("canCreate");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const contentType = req.headers.get("content-type") || "";
    let body = {};
    let attachmentFile = null;

    // Support multipart form-data for file uploads
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
      // Fallback to JSON body (no file upload)
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

    let attachments = [];

    // Optional attachment handling
    if (attachmentFile && typeof attachmentFile !== "string") {
      const ALLOWED_EXT = new Set([
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png",
      ]);
      const MAX_SIZE = 25 * 1024 * 1024; // 25MB

      if (attachmentFile.size > MAX_SIZE) {
        return NextResponse.json(
          { message: "File exceeds 25MB limit" },
          { status: 400 }
        );
      }

      const ext = path.extname(attachmentFile.name || "").toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          {
            message:
              "Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG",
          },
          { status: 400 }
        );
      }

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        "warehouse-management"
      );
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const safeFileName = (attachmentFile.name || "file").replace(
        /\s+/g,
        "_"
      );
      const fileName = `${timestamp}-${safeFileName}`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      attachments.push({
        filePath,
        fileName: attachmentFile.name || safeFileName,
      });
    }

    const record = await WarehouseManagement.create({
      ...body,
      location: String(body.location).trim(),
      nos: Number(body.nos),
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.estimatedEndDate && {
        estimatedEndDate: new Date(body.estimatedEndDate),
      }),
      ...(attachments.length > 0 && { attachments }),
    });

    void notifyCreate(NOTIFICATION_MODULES.PMS, "Warehouse Management", record._id);

    return NextResponse.json(
      { success: true, data: record },
      { status: 201 }
    );
  } catch (error) {
    console.error("Warehouse create error:", error);
    return NextResponse.json(
      { message: error.message },
      { status: 500 }
    );
  }
}
