import { NextResponse } from "next/server";
import Accessories from "@/lib/mongodb/models/pms/Accessories.js";
import { connectDB } from "@/lib/config/connection.js";
import path from "path";
import fs from "fs/promises";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyCreate } from "@/lib/notifications/moduleNotify";
import {
  sanitizePmsPathSegment as sanitize,
  sanitizePmsUploadedFileName as sanitizeFileName,
} from "@/lib/utils/pms-upload-filename";

export async function POST(req) {
  const guard = await assertPmsPermission("canCreate");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const formData = await req.formData();

    const category = formData.get("category");
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

    // -----------------------------
    // Basic Validation
    // -----------------------------
    if (!category || !equipmentName || !placedIn) {
      return NextResponse.json(
        { message: "Required fields missing" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Category Specific Validation
    // -----------------------------
    if (category === "REGULAR") {
      if (!equipmentNo) {
        return NextResponse.json(
          { message: "Equipment number is required for REGULAR accessories" },
          { status: 400 }
        );
      }
    }

    if (category === "OCCASIONAL") {
      if (!quantity || quantity <= 0) {
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
                "When test schedule is enabled for occasional accessories, both test date and next due are required",
            },
            { status: 400 }
          );
        }
      }
    }

    // -----------------------------
    // Enum Safety
    // -----------------------------
    const validCategories = ["REGULAR", "OCCASIONAL"];
    const validStatuses = ["ACTIVE", "INACTIVE"];
    const validLocations = ["OFFICE", "BAY", "BASE"];

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { message: "Invalid category value" },
        { status: 400 }
      );
    }

    if (category === "OCCASIONAL" && status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { message: "Invalid status value" },
        { status: 400 }
      );
    }

    if (!validLocations.includes(placedIn)) {
      return NextResponse.json(
        { message: "Invalid placedIn value" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Business Rule Validation
    // -----------------------------
    if (putInUse && !putInUseDate) {
      return NextResponse.json(
        { message: "Put in use date is required" },
        { status: 400 }
      );
    }

    // -----------------------------
    // Duplicate Check (REGULAR only)
    // -----------------------------
    if (category === "REGULAR") {
      const exists = await Accessories.findOne({ equipmentNo });
      if (exists) {
        return NextResponse.json(
          { message: "Accessory with this equipment number already exists" },
          { status: 409 }
        );
      }
    }

    // -----------------------------
    // Create Record
    // -----------------------------
    const accessoryData = {
      category,
      status: category === "OCCASIONAL" ? status : "ACTIVE",
      equipmentName: equipmentName.trim(),
      placedIn,
      locationName: locationName.trim(),
      putInUse: putInUse || false
    };

    // Add optional fields only if they have values
    if (specification && typeof specification === "string" && specification.trim()) {
      accessoryData.specification = specification.trim();
    }

    if (purchaseDate) {
      try {
        accessoryData.purchaseDate = new Date(purchaseDate);
        // Validate date
        if (isNaN(accessoryData.purchaseDate.getTime())) {
          delete accessoryData.purchaseDate;
        }
      } catch (e) {
        // Invalid date, skip it
      }
    }

    if (remarks && typeof remarks === "string" && remarks.trim()) {
      accessoryData.remarks = remarks.trim();
    }

    if (putInUse && putInUseDate) {
      try {
        accessoryData.putInUseDate = new Date(putInUseDate);
        // Validate date
        if (isNaN(accessoryData.putInUseDate.getTime())) {
          return NextResponse.json(
            { message: "Invalid put in use date" },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          { message: "Invalid put in use date format" },
          { status: 400 }
        );
      }
    }

    // Add category-specific fields
    if (category === "REGULAR") {
      accessoryData.equipmentNo = String(equipmentNo).trim();
    }

    if (category === "OCCASIONAL") {
      accessoryData.quantity = Number(quantity);
      accessoryData.occasionalTrackTestSchedule = occasionalTrackTestSchedule;
      if (occasionalTrackTestSchedule) {
        try {
          accessoryData.occasionalTestDate = new Date(occasionalTestDate);
          accessoryData.occasionalNextDueDate = new Date(occasionalNextDueDate);
          if (
            Number.isNaN(accessoryData.occasionalTestDate.getTime()) ||
            Number.isNaN(accessoryData.occasionalNextDueDate.getTime())
          ) {
            return NextResponse.json(
              { message: "Invalid occasional test date or next due date" },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { message: "Invalid occasional test date or next due date" },
            { status: 400 }
          );
        }
      }
    }

    // Handle Manufacturing Certificate file
    let manufacturingCertificate = { fileUrl: "", originalFileName: "" };
    const manufacturingCertFile = formData.get("manufacturingCertificate");
    if (manufacturingCertFile && typeof manufacturingCertFile !== "string" && manufacturingCertFile.name && manufacturingCertFile.size > 0) {
      const identifier = category === "REGULAR" ? sanitize(equipmentNo.trim()) : sanitize(equipmentName.trim());
      const baseDir = path.join(process.cwd(), "public/uploads/pms/accessories", identifier, "manufacturing-certificate");
      await fs.mkdir(baseDir, { recursive: true });

      const buffer = Buffer.from(await manufacturingCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizeFileName(manufacturingCertFile.name)}`;
      const filePath = path.join(baseDir, fileName);
      await fs.writeFile(filePath, buffer);

      manufacturingCertificate = {
        fileUrl: `/uploads/pms/accessories/${identifier}/manufacturing-certificate/${fileName}`,
        originalFileName: manufacturingCertFile.name,
      };
    }

    // Handle Test Certificate file
    let testCertificate = { fileUrl: "", originalFileName: "" };
    const testCertFile = formData.get("testCertificate");
    if (testCertFile && typeof testCertFile !== "string" && testCertFile.name && testCertFile.size > 0) {
      const identifier = category === "REGULAR" ? sanitize(equipmentNo.trim()) : sanitize(equipmentName.trim());
      const baseDir = path.join(process.cwd(), "public/uploads/pms/accessories", identifier, "test-certificate");
      await fs.mkdir(baseDir, { recursive: true });

      const buffer = Buffer.from(await testCertFile.arrayBuffer());
      const fileName = `${Date.now()}-${sanitizeFileName(testCertFile.name)}`;
      const filePath = path.join(baseDir, fileName);
      await fs.writeFile(filePath, buffer);

      testCertificate = {
        fileUrl: `/uploads/pms/accessories/${identifier}/test-certificate/${fileName}`,
        originalFileName: testCertFile.name,
      };
    }

    accessoryData.manufacturingCertificate = manufacturingCertificate;
    accessoryData.testCertificate = testCertificate;

    const accessory = await Accessories.create(accessoryData);

    void notifyCreate(NOTIFICATION_MODULES.PMS, "Accessories", accessory._id);

    return NextResponse.json(
      {
        message: "Accessory created successfully",
        data: accessory
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Accessories Error:", error);
    console.error("Error Stack:", error.stack);
    console.error("Error Name:", error.name);

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json(
        { message: messages.join(", ") || "Validation error" },
        { status: 400 }
      );
    }

    // Handle duplicate key errors
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
