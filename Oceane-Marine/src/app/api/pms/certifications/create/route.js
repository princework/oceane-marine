import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Certificate from "@/lib/mongodb/models/pms/Certificate";
import path from "path";
import fs from "fs/promises";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyCreate } from "@/lib/notifications/moduleNotify";
import {
  sanitizePmsPathSegment,
  sanitizePmsUploadedFileName,
} from "@/lib/utils/pms-upload-filename";

export async function POST(req) {
    const guard = await assertPmsPermission("canCreate");
    if (!guard.ok) return guard.response;
    await connectDB();

    try {
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

        // Validate files - check if they are valid File objects
        if (!manufacturingFile || typeof manufacturingFile === "string" || !manufacturingFile.name || manufacturingFile.size === 0) {
            return NextResponse.json(
                { message: "Manufacturing certificate file is required" },
                { status: 400 }
            );
        }
        if (!testFile || typeof testFile === "string" || !testFile.name || testFile.size === 0) {
            return NextResponse.json(
                { message: "Test certificate file is required" },
                { status: 400 }
            );
        }

        // Create directory structure: location/equipmentName/equipmentType/
        const baseDir = path.join(
            process.cwd(),
            "public/uploads/certificates",
            sanitizePmsPathSegment(locationName.trim()),
            sanitizePmsPathSegment(equipmentName.trim()),
            sanitizePmsPathSegment(equipmentType.trim())
        );
        await fs.mkdir(baseDir, { recursive: true });

        // Save Manufacturing Certificate
        const manufacturingBuffer = Buffer.from(await manufacturingFile.arrayBuffer());
        const manufacturingFileName = `manufacturing-${Date.now()}-${sanitizePmsUploadedFileName(manufacturingFile.name)}`;
        const manufacturingFilePath = path.join(baseDir, manufacturingFileName);
        await fs.writeFile(manufacturingFilePath, manufacturingBuffer);
        const manufacturingFileUrl = `/uploads/certificates/${sanitizePmsPathSegment(locationName.trim())}/${sanitizePmsPathSegment(equipmentName.trim())}/${sanitizePmsPathSegment(equipmentType.trim())}/${manufacturingFileName}`;

        // Save Test Certificate
        const testBuffer = Buffer.from(await testFile.arrayBuffer());
        const testFileName = `test-${Date.now()}-${sanitizePmsUploadedFileName(testFile.name)}`;
        const testFilePath = path.join(baseDir, testFileName);
        await fs.writeFile(testFilePath, testBuffer);
        const testFileUrl = `/uploads/certificates/${sanitizePmsPathSegment(locationName.trim())}/${sanitizePmsPathSegment(equipmentName.trim())}/${sanitizePmsPathSegment(equipmentType.trim())}/${testFileName}`;

        const cert = await Certificate.create({
            locationName: locationName.trim(),
            equipmentName: equipmentName.trim(),
            equipmentType: equipmentType.trim(),
            testedBy: testedBy.trim(),
            manufacturingCertificate: {
                fileUrl: manufacturingFileUrl,
                originalFileName: manufacturingFile.name,
            },
            testCertificate: {
                fileUrl: testFileUrl,
                originalFileName: testFile.name,
            },
        });

        void notifyCreate(NOTIFICATION_MODULES.PMS, "Certifications", cert._id);

        return NextResponse.json({ data: cert }, { status: 201 });
    } catch (err) {
        console.error("Certificate creation error:", err);
        return NextResponse.json(
            { message: err.message || "Upload failed", error: err.message },
            { status: 500 }
        );
    }
}
