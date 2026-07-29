import { NextResponse } from "next/server";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import Accessories from "@/lib/mongodb/models/pms/Accessories.js";
import { connectDB } from "@/lib/config/connection.js";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyDelete, notifyEdit } from "@/lib/notifications/moduleNotify";
import {
  createPmsInventoryCertificateArchiveEntry,
  PMS_ACCESSORIES_CERT_ARCHIVE_MODULE,
} from "@/lib/pms/createPmsInventoryCertificateArchiveEntry";
import {
  sanitizePmsPathSegment as sanitize,
  sanitizePmsUploadedFileName as sanitizeFileName,
} from "@/lib/utils/pms-upload-filename";

export async function PATCH(req, { params }) {
  const guard = await assertPmsPermission("canEdit");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid accessory id" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await Accessories.findById(id);
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ message: "Accessory not found" }, { status: 404 });
    }

    const category = existing.category;

    const formData = await req.formData();
    const status = formData.get("status");
    const equipmentNo = formData.get("equipmentNo");
    const equipmentName = formData.get("equipmentName");
    const specification = formData.get("specification");
    const purchaseDate = formData.get("purchaseDate");
    const remarks = formData.get("remarks");
    const quantity = formData.get("quantity");
    const putInUse = formData.get("putInUse") === "true";
    const putInUseDate = formData.get("putInUseDate");
    const placedIn = formData.get("placedIn");
    const locationName =
      (formData.get("locationName") && String(formData.get("locationName"))) || "";
    const occasionalTrackTestSchedule =
      formData.get("occasionalTrackTestSchedule") === "true";
    const occasionalTestDate = formData.get("occasionalTestDate");
    const occasionalNextDueDate = formData.get("occasionalNextDueDate");

    if (!equipmentName || !placedIn) {
      return NextResponse.json(
        { message: "Required fields missing" },
        { status: 400 }
      );
    }

    const validStatuses = ["ACTIVE", "INACTIVE"];
    const validLocations = ["OFFICE", "BAY", "BASE"];

    if (category === "OCCASIONAL" && status && !validStatuses.includes(status)) {
      return NextResponse.json({ message: "Invalid status value" }, { status: 400 });
    }

    if (!validLocations.includes(placedIn)) {
      return NextResponse.json(
        { message: "Invalid placedIn value" },
        { status: 400 }
      );
    }

    if (category === "REGULAR") {
      if (!equipmentNo) {
        return NextResponse.json(
          { message: "Equipment number is required for REGULAR accessories" },
          { status: 400 }
        );
      }
      const eno = String(equipmentNo).trim();
      const dup = await Accessories.findOne({
        equipmentNo: eno,
        _id: { $ne: id },
        isDeleted: { $ne: true },
      }).select("_id");
      if (dup) {
        return NextResponse.json(
          { message: "Another accessory already uses this equipment number" },
          { status: 409 }
        );
      }
    }

    if (category === "OCCASIONAL") {
      if (!quantity || Number(quantity) <= 0) {
        return NextResponse.json(
          { message: "Quantity is required for OCCASIONAL accessories" },
          { status: 400 }
        );
      }
      if (occasionalTrackTestSchedule) {
        if (!occasionalTestDate || !occasionalNextDueDate) {
          return NextResponse.json(
            {
              message:
                "When test schedule is enabled, both test date and next due are required",
            },
            { status: 400 }
          );
        }
      }
    }

    if (putInUse && !putInUseDate) {
      return NextResponse.json(
        { message: "Put in use date is required" },
        { status: 400 }
      );
    }

    const updatePayload = {
      equipmentName: String(equipmentName).trim(),
      placedIn,
      locationName: locationName.trim(),
      putInUse: putInUse || false,
      status: category === "OCCASIONAL" ? status : "ACTIVE",
    };

    if (specification && typeof specification === "string" && specification.trim()) {
      updatePayload.specification = specification.trim();
    } else {
      updatePayload.specification = "";
    }

    if (remarks && typeof remarks === "string" && remarks.trim()) {
      updatePayload.remarks = remarks.trim();
    } else {
      updatePayload.remarks = "";
    }

    const unsetFields = {};

    if (purchaseDate) {
      const d = new Date(purchaseDate);
      if (!Number.isNaN(d.getTime())) {
        updatePayload.purchaseDate = d;
      }
    } else {
      unsetFields.purchaseDate = "";
    }

    if (putInUse && putInUseDate) {
      const d = new Date(putInUseDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { message: "Invalid put in use date" },
          { status: 400 }
        );
      }
      updatePayload.putInUseDate = d;
    } else {
      unsetFields.putInUseDate = "";
    }


    if (category === "REGULAR") {
      updatePayload.equipmentNo = String(equipmentNo).trim();
      unsetFields.quantity = "";
      unsetFields.occasionalTrackTestSchedule = "";
      unsetFields.occasionalTestDate = "";
      unsetFields.occasionalNextDueDate = "";
    }

    if (category === "OCCASIONAL") {
      updatePayload.quantity = Number(quantity);
      updatePayload.occasionalTrackTestSchedule = occasionalTrackTestSchedule;
      unsetFields.equipmentNo = "";
      if (occasionalTrackTestSchedule) {
        const d1 = new Date(occasionalTestDate);
        const d2 = new Date(occasionalNextDueDate);
        if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
          return NextResponse.json(
            { message: "Invalid occasional test date or next due date" },
            { status: 400 }
          );
        }
        updatePayload.occasionalTestDate = d1;
        updatePayload.occasionalNextDueDate = d2;
      } else {
        unsetFields.occasionalTestDate = "";
        unsetFields.occasionalNextDueDate = "";
      }
    }

    const manufacturingCertFile = formData.get("manufacturingCertificate");
    const hasNewManufacturingFile =
      manufacturingCertFile &&
      typeof manufacturingCertFile !== "string" &&
      manufacturingCertFile.name &&
      manufacturingCertFile.size > 0;

    const testCertFile = formData.get("testCertificate");
    const hasNewTestFile =
      testCertFile &&
      typeof testCertFile !== "string" &&
      testCertFile.name &&
      testCertFile.size > 0;

    const prevManufacturingUrl =
      existing.manufacturingCertificate?.fileUrl?.trim?.() || "";
    const prevTestUrl = existing.testCertificate?.fileUrl?.trim?.() || "";

    const shouldArchiveBeforeCertReplace =
      (hasNewManufacturingFile && prevManufacturingUrl) ||
      (hasNewTestFile && prevTestUrl);

    if (shouldArchiveBeforeCertReplace) {
      const parts = [];
      if (hasNewManufacturingFile && prevManufacturingUrl) {
        parts.push("manufacturing certificate replaced");
      }
      if (hasNewTestFile && prevTestUrl) {
        parts.push("test certificate replaced");
      }
      await createPmsInventoryCertificateArchiveEntry({
        doc: existing,
        moduleLabel: PMS_ACCESSORIES_CERT_ARCHIVE_MODULE,
        inventoryKind: "accessories",
        archiveReason: parts.join("; ") || "Certificate files replaced",
        triggeredBy: "replace_on_save",
        replacedManufacturing: !!(hasNewManufacturingFile && prevManufacturingUrl),
        replacedTest: !!(hasNewTestFile && prevTestUrl),
        scope: "both",
      });
    }

    if (hasNewManufacturingFile) {
      const identifier =
        category === "REGULAR"
          ? sanitize(String(equipmentNo).trim())
          : sanitize(String(equipmentName).trim());
      const baseDir = path.join(
        process.cwd(),
        "public/uploads/pms/accessories",
        identifier,
        "manufacturing-certificate"
      );
      await fs.mkdir(baseDir, { recursive: true });
      const buffer = Buffer.from(await manufacturingCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizeFileName(manufacturingCertFile.name)}`;
      await fs.writeFile(path.join(baseDir, fileName), buffer);
      updatePayload.manufacturingCertificate = {
        fileUrl: `/uploads/pms/accessories/${identifier}/manufacturing-certificate/${fileName}`,
        originalFileName: manufacturingCertFile.name,
      };
    }

    if (hasNewTestFile) {
      const identifier =
        category === "REGULAR"
          ? sanitize(String(equipmentNo).trim())
          : sanitize(String(equipmentName).trim());
      const baseDir = path.join(
        process.cwd(),
        "public/uploads/pms/accessories",
        identifier,
        "test-certificate"
      );
      await fs.mkdir(baseDir, { recursive: true });
      const buffer = Buffer.from(await testCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizeFileName(testCertFile.name)}`;
      await fs.writeFile(path.join(baseDir, fileName), buffer);
      updatePayload.testCertificate = {
        fileUrl: `/uploads/pms/accessories/${identifier}/test-certificate/${fileName}`,
        originalFileName: testCertFile.name,
      };
    }

    const updateOps = { $set: updatePayload };
    if (Object.keys(unsetFields).length > 0) {
      updateOps.$unset = unsetFields;
    }

    const updated = await Accessories.findByIdAndUpdate(id, updateOps, {
      new: true,
      runValidators: true,
    });

    void notifyEdit(NOTIFICATION_MODULES.PMS, "Accessories", id);

    return NextResponse.json({
      message: "Accessory updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Accessories Error:", error);
    if (error.code === 11000) {
      return NextResponse.json(
        { message: "Accessory with this equipment number already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  const guard = await assertPmsPermission("canDelete");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid accessory id" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await Accessories.findById(id);
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ message: "Accessory not found" }, { status: 404 });
    }

    await Accessories.findByIdAndDelete(id);

    void notifyDelete(NOTIFICATION_MODULES.PMS, "Accessories", id);

    return NextResponse.json({ message: "Accessory deleted successfully" });
  } catch (error) {
    console.error("Delete Accessories Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
