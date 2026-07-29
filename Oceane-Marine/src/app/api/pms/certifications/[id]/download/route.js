import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import Certificate from "@/lib/mongodb/models/pms/Certificate";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export const runtime = "nodejs";

export async function GET(req, ctx) {
    const guard = await assertPmsPermission("canDownload");
    if (!guard.ok) return guard.response;
    await connectDB();

    const { id } = (await ctx?.params) || {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "manufacturing"; // "manufacturing" or "test"

        const record = await Certificate.findById(id);
        if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Get the appropriate certificate based on type
        let certificateData = null;
        if (type === "test" && record.testCertificate) {
            certificateData = record.testCertificate;
        } else if (type === "manufacturing" && record.manufacturingCertificate) {
            certificateData = record.manufacturingCertificate;
        } else {
            // Fallback: try to get any available certificate
            certificateData = record.testCertificate || record.manufacturingCertificate;
        }

        if (!certificateData || !certificateData.fileUrl) {
            return NextResponse.json({ error: "Certificate file not found" }, { status: 404 });
        }

        // fileUrl is stored as /uploads/certificates/..., but files are in public/uploads/certificates/
        let filePath = certificateData.fileUrl;
        if (filePath.startsWith("/uploads/")) {
            filePath = path.join("public", filePath);
        }
        
        const absPath = path.isAbsolute(filePath) 
            ? filePath 
            : path.join(process.cwd(), filePath);

        if (!fs.existsSync(absPath)) {
            console.error("File not found at:", absPath);
            console.error("Original fileUrl:", certificateData.fileUrl);
            return NextResponse.json({ error: "File missing on server" }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(absPath);
        // Use originalFileName if available, otherwise use the filename from path
        const fileName = certificateData.originalFileName || path.basename(absPath);
        const fileExt = path.extname(fileName).toLowerCase();
        const contentTypeMap = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx":
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt": "text/plain",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        };
        const contentType =
            contentTypeMap[fileExt] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}