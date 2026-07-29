import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Certificate from "@/lib/mongodb/models/pms/Certificate";
import path from "path";
import fs from "fs/promises";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyEdit } from "@/lib/notifications/moduleNotify";
import {
  sanitizePmsPathSegment,
  sanitizePmsUploadedFileName,
} from "@/lib/utils/pms-upload-filename";

export async function PUT(req, ctx) {
    const guard = await assertPmsPermission("canEdit");
    if (!guard.ok) return guard.response;
    await connectDB();

    try {
        const { id } = (await ctx?.params) || {};
        if (!id) {
            return NextResponse.json(
                { message: "Missing certificate id" },
                { status: 400 }
            );
        }

        const existing = await Certificate.findById(id);
        if (!existing) {
            return NextResponse.json(
                { message: "Certificate not found" },
                { status: 404 }
            );
        }

        const formData = await req.formData();

        const locationName = formData.get("locationName");
        const equipmentName = formData.get("equipmentName");
        const equipmentType = formData.get("equipmentType");
        const testedBy = formData.get("testedBy");
        const manufacturingFile = formData.get("manufacturingFile");
        const testFile = formData.get("testFile");

        // Validate text fields
        if (!locationName || !locationName.trim()) {
            return NextResponse.json(
                { message: "Location name is required" },
                { status: 400 }
            );
        }
        if (!equipmentName || !equipmentName.trim()) {
            return NextResponse.json(
                { message: "Equipment name is required" },
                { status: 400 }
            );
        }
        if (!equipmentType || !equipmentType.trim()) {
            return NextResponse.json(
                { message: "Equipment type is required" },
                { status: 400 }
            );
        }
        if (!testedBy || !testedBy.trim()) {
            return NextResponse.json(
                { message: "Tested by is required" },
                { status: 400 }
            );
        }

        const baseDir = path.join(
            process.cwd(),
            "public/uploads/certificates",
            sanitizePmsPathSegment(locationName.trim()),
            sanitizePmsPathSegment(equipmentName.trim()),
            sanitizePmsPathSegment(equipmentType.trim())
        );
        await fs.mkdir(baseDir, { recursive: true });

        // Update text fields
        existing.locationName = locationName.trim();
        existing.equipmentName = equipmentName.trim();
        existing.equipmentType = equipmentType.trim();
        existing.testedBy = testedBy.trim();

        // Handle Manufacturing Certificate - only update if new file provided
        if (manufacturingFile && typeof manufacturingFile !== "string" && manufacturingFile.name && manufacturingFile.size > 0) {
            // Delete old file if exists
            if (existing.manufacturingCertificate?.fileUrl) {
                const oldPath = path.join(process.cwd(), "public", existing.manufacturingCertificate.fileUrl);
                try {
                    await fs.unlink(oldPath);
                } catch (err) {
                    console.warn("Could not delete old manufacturing file:", err);
                }
            }

            // Save new file
            const manufacturingBuffer = Buffer.from(await manufacturingFile.arrayBuffer());
            const manufacturingFileName = `manufacturing-${Date.now()}-${sanitizePmsUploadedFileName(manufacturingFile.name)}`;
            const manufacturingFilePath = path.join(baseDir, manufacturingFileName);
            await fs.writeFile(manufacturingFilePath, manufacturingBuffer);
            const manufacturingFileUrl = `/uploads/certificates/${sanitizePmsPathSegment(locationName.trim())}/${sanitizePmsPathSegment(equipmentName.trim())}/${sanitizePmsPathSegment(equipmentType.trim())}/${manufacturingFileName}`;

            existing.manufacturingCertificate = {
                fileUrl: manufacturingFileUrl,
                originalFileName: manufacturingFile.name,
            };
        }

        // Handle Test Certificate - only update if new file provided
        if (testFile && typeof testFile !== "string" && testFile.name && testFile.size > 0) {
            // Delete old file if exists
            if (existing.testCertificate?.fileUrl) {
                const oldPath = path.join(process.cwd(), "public", existing.testCertificate.fileUrl);
                try {
                    await fs.unlink(oldPath);
                } catch (err) {
                    console.warn("Could not delete old test file:", err);
                }
            }

            // Save new file
            const testBuffer = Buffer.from(await testFile.arrayBuffer());
            const testFileName = `test-${Date.now()}-${sanitizePmsUploadedFileName(testFile.name)}`;
            const testFilePath = path.join(baseDir, testFileName);
            await fs.writeFile(testFilePath, testBuffer);
            const testFileUrl = `/uploads/certificates/${sanitizePmsPathSegment(locationName.trim())}/${sanitizePmsPathSegment(equipmentName.trim())}/${sanitizePmsPathSegment(equipmentType.trim())}/${testFileName}`;

            existing.testCertificate = {
                fileUrl: testFileUrl,
                originalFileName: testFile.name,
            };
        }

        await existing.save();

        void notifyEdit(NOTIFICATION_MODULES.PMS, "Certifications", existing._id);

        return NextResponse.json({ data: existing }, { status: 200 });
    } catch (err) {
        console.error("Certificate update error:", err);
        return NextResponse.json(
            { message: err.message || "Update failed", error: err.message },
            { status: 500 }
        );
    }
}
