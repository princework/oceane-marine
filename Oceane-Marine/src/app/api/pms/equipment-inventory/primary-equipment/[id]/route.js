import { NextResponse } from "next/server";
import mongoose from "mongoose";
import path from "path";
import fs from "fs/promises";
import { connectDB } from "@/lib/config/connection";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import EquipmentTest from "@/lib/mongodb/models/pms/EquipmentTest";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyDelete, notifyEdit } from "@/lib/notifications/moduleNotify";
import {
  createPmsInventoryCertificateArchiveEntry,
  PMS_PRIMARY_EQUIPMENT_CERT_ARCHIVE_MODULE,
} from "@/lib/pms/createPmsInventoryCertificateArchiveEntry";
import {
  sanitizePmsPathSegment as sanitize,
  sanitizePmsUploadedFileName,
} from "@/lib/utils/pms-upload-filename";

export async function PATCH(req, { params }) {
  const guard = await assertPmsPermission("canEdit");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid equipment id" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await Equipment.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Equipment not found" }, { status: 404 });
    }

    const formData = await req.formData();

    const equipmentCode = formData.get("equipmentCode");
    const equipmentName = formData.get("equipmentName");
    const equipmentType = formData.get("equipmentType") || "";
    const specification = formData.get("specification") || "";
    const manufacturer = formData.get("manufacturer") || "";
    const yearOfManufacturing = formData.get("yearOfManufacturing");
    const ownershipType = formData.get("ownershipType");
    const dateOfPurchase = formData.get("dateOfPurchase");
    const firstUseDate = formData.get("firstUseDate");
    const lastTestDate = formData.get("lastTestDate");
    const nextTestDate = formData.get("nextTestDate");
    const retirementPeriodYears = formData.get("retirementPeriodYears");
    const remarks = formData.get("remarks") || "";
    const placedInOffice = formData.get("placedInOffice") === "true";
    const placedInBase = formData.get("placedInBase") === "true";
    const placedInBay = formData.get("placedInBay") === "true";
    const entity = (formData.get("entity") && String(formData.get("entity"))) || "";
    const locationName =
      (formData.get("locationName") && String(formData.get("locationName"))) || "";

    if (!equipmentCode || !equipmentName || !ownershipType) {
      return NextResponse.json(
        { message: "Required fields missing" },
        { status: 400 }
      );
    }

    if (!placedInOffice && !placedInBase && !placedInBay) {
      return NextResponse.json(
        { message: "Placed in: select at least one of Office, Base, or Bay" },
        { status: 400 }
      );
    }

    let dateToBeRetired = null;
    if (firstUseDate && retirementPeriodYears) {
      dateToBeRetired = new Date(firstUseDate);
      dateToBeRetired.setFullYear(
        dateToBeRetired.getFullYear() + Number(retirementPeriodYears)
      );
    }

    const updatePayload = {
      equipmentCode: String(equipmentCode).trim(),
      equipmentName: String(equipmentName).trim(),
      equipmentType,
      specification,
      manufacturer,
      yearOfManufacturing: yearOfManufacturing
        ? Number(yearOfManufacturing)
        : undefined,
      ownershipType,
      placedInOffice,
      placedInBase,
      placedInBay,
      entity: entity.trim(),
      locationName: locationName.trim(),
      dateOfPurchase: dateOfPurchase ? new Date(dateOfPurchase) : undefined,
      firstUseDate: firstUseDate ? new Date(firstUseDate) : undefined,
      lastTestDate: lastTestDate ? new Date(lastTestDate) : undefined,
      nextTestDate: nextTestDate ? new Date(nextTestDate) : undefined,
      retirementPeriodYears: retirementPeriodYears
        ? Number(retirementPeriodYears)
        : 10,
      dateToBeRetired,
      remarks,
    };

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
        moduleLabel: PMS_PRIMARY_EQUIPMENT_CERT_ARCHIVE_MODULE,
        inventoryKind: "primary_equipment",
        archiveReason: parts.join("; ") || "Certificate files replaced",
        triggeredBy: "replace_on_save",
        replacedManufacturing: !!(hasNewManufacturingFile && prevManufacturingUrl),
        replacedTest: !!(hasNewTestFile && prevTestUrl),
        scope: "both",
      });
    }

    if (hasNewManufacturingFile) {
      const sanitizedCode = sanitize(String(equipmentCode).trim());
      const baseDir = path.join(
        process.cwd(),
        "public/uploads/pms/equipment",
        sanitizedCode,
        "manufacturing-certificate"
      );
      await fs.mkdir(baseDir, { recursive: true });
      const buffer = Buffer.from(await manufacturingCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizePmsUploadedFileName(manufacturingCertFile.name)}`;
      await fs.writeFile(path.join(baseDir, fileName), buffer);
      updatePayload.manufacturingCertificate = {
        fileUrl: `/uploads/pms/equipment/${sanitizedCode}/manufacturing-certificate/${fileName}`,
        originalFileName: manufacturingCertFile.name,
      };
    }

    if (hasNewTestFile) {
      const sanitizedCode = sanitize(String(equipmentCode).trim());
      const baseDir = path.join(
        process.cwd(),
        "public/uploads/pms/equipment",
        sanitizedCode,
        "test-certificate"
      );
      await fs.mkdir(baseDir, { recursive: true });
      const buffer = Buffer.from(await testCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizePmsUploadedFileName(testCertFile.name)}`;
      await fs.writeFile(path.join(baseDir, fileName), buffer);
      updatePayload.testCertificate = {
        fileUrl: `/uploads/pms/equipment/${sanitizedCode}/test-certificate/${fileName}`,
        originalFileName: testCertFile.name,
      };
    }

    const prevNext = existing.nextTestDate
      ? new Date(existing.nextTestDate).getTime()
      : null;
    const newNext = nextTestDate ? new Date(nextTestDate).getTime() : null;
    const nextTestChanged = prevNext !== newNext;

    const updateOps = { $set: updatePayload };
    if (nextTestChanged) {
      updateOps.$unset = {
        pmsTestReminder30dSentForNextTestDate: "",
        pmsTestReminder15dSentForNextTestDate: "",
      };
    }

    const updated = await Equipment.findByIdAndUpdate(id, updateOps, {
      new: true,
      runValidators: true,
    });

    void notifyEdit(NOTIFICATION_MODULES.PMS, "Primary Equipment", id);

    return NextResponse.json({
      message: "Equipment updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Equipment Error:", error);
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
    return NextResponse.json({ message: "Invalid equipment id" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await Equipment.findById(id).select("equipmentCode").lean();
    if (!existing) {
      return NextResponse.json({ message: "Equipment not found" }, { status: 404 });
    }

    const [testUse, opUse] = await Promise.all([
      EquipmentTest.findOne({ equipment: id }).select("_id").lean(),
      StsOperation.findOne({ "equipments.equipment": id }).select("_id").lean(),
    ]);

    if (testUse) {
      return NextResponse.json(
        {
          message:
            "Cannot delete: this equipment has equipment testing records. Remove or reassign tests first.",
        },
        { status: 409 }
      );
    }
    if (opUse) {
      return NextResponse.json(
        {
          message:
            "Cannot delete: this equipment is referenced on STS operations. Remove it from operations first.",
        },
        { status: 409 }
      );
    }

    await Equipment.findByIdAndDelete(id);

    void notifyDelete(NOTIFICATION_MODULES.PMS, "Primary Equipment", id);

    return NextResponse.json({ message: "Equipment deleted successfully" });
  } catch (error) {
    console.error("Delete Equipment Error:", error);
    return NextResponse.json(
      { message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
