import { NextResponse } from "next/server";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { connectDB } from "@/lib/config/connection";
import path from "path";
import fs from "fs/promises";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyCreate } from "@/lib/notifications/moduleNotify";
import {
  sanitizePmsPathSegment as sanitize,
  sanitizePmsUploadedFileName,
} from "@/lib/utils/pms-upload-filename";

export async function POST(req) {
  const guard = await assertPmsPermission("canCreate");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

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

    // Handle Manufacturing Certificate file
    let manufacturingCertificate = { fileUrl: "", originalFileName: "" };
    const manufacturingCertFile = formData.get("manufacturingCertificate");
    if (manufacturingCertFile && typeof manufacturingCertFile !== "string" && manufacturingCertFile.name && manufacturingCertFile.size > 0) {
      const sanitizedCode = sanitize(equipmentCode.trim());
      const baseDir = path.join(process.cwd(), "public/uploads/pms/equipment", sanitizedCode, "manufacturing-certificate");
      await fs.mkdir(baseDir, { recursive: true });

      const buffer = Buffer.from(await manufacturingCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizePmsUploadedFileName(manufacturingCertFile.name)}`;
      const filePath = path.join(baseDir, fileName);
      await fs.writeFile(filePath, buffer);

      manufacturingCertificate = {
        fileUrl: `/uploads/pms/equipment/${sanitizedCode}/manufacturing-certificate/${fileName}`,
        originalFileName: manufacturingCertFile.name,
      };
    }

    // Handle Test Certificate file
    let testCertificate = { fileUrl: "", originalFileName: "" };
    const testCertFile = formData.get("testCertificate");
    if (testCertFile && typeof testCertFile !== "string" && testCertFile.name && testCertFile.size > 0) {
      const sanitizedCode = sanitize(equipmentCode.trim());
      const baseDir = path.join(process.cwd(), "public/uploads/pms/equipment", sanitizedCode, "test-certificate");
      await fs.mkdir(baseDir, { recursive: true });

      const buffer = Buffer.from(await testCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizePmsUploadedFileName(testCertFile.name)}`;
      const filePath = path.join(baseDir, fileName);
      await fs.writeFile(filePath, buffer);

      testCertificate = {
        fileUrl: `/uploads/pms/equipment/${sanitizedCode}/test-certificate/${fileName}`,
        originalFileName: testCertFile.name,
      };
    }

    const serialYear = new Date().getFullYear();
    const serialCode = await getNextYearwiseSerial(
      "PMS_PRIMARY_EQUIPMENT",
      serialYear
    );

    const equipment = await Equipment.create({
      equipmentCode,
      serialCode,
      equipmentName,
      equipmentType,
      specification,
      manufacturer,
      yearOfManufacturing: yearOfManufacturing ? Number(yearOfManufacturing) : undefined,
      ownershipType,

      status: "ACTIVE",
      isInUse: false,

      placedInOffice,
      placedInBase,
      placedInBay,

      entity: entity.trim(),
      locationName: locationName.trim(),

      dateOfPurchase: dateOfPurchase ? new Date(dateOfPurchase) : undefined,
      firstUseDate: firstUseDate ? new Date(firstUseDate) : undefined,
      lastTestDate: lastTestDate ? new Date(lastTestDate) : undefined,
      nextTestDate: nextTestDate ? new Date(nextTestDate) : undefined,

      retirementPeriodYears: retirementPeriodYears ? Number(retirementPeriodYears) : 10,
      dateToBeRetired,

      manufacturingCertificate,
      testCertificate,
      remarks
    });

    void notifyCreate(NOTIFICATION_MODULES.PMS, "Primary Equipment", equipment._id);

    return NextResponse.json(
      {
        message: "Equipment created successfully",
        data: equipment
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Equipment Error:", error);

    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      return NextResponse.json(
        { message: messages.join(", ") || "Validation error" },
        { status: 400 }
      );
    }
    if (error?.code === 11000) {
      return NextResponse.json(
        { message: "Equipment with the same unique key already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
