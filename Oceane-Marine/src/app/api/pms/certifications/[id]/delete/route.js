import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Certificate from "@/lib/mongodb/models/pms/Certificate";
import path from "path";
import fs from "fs/promises";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyDelete } from "@/lib/notifications/moduleNotify";

export async function DELETE(req, ctx) {
    const guard = await assertPmsPermission("canDelete");
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

        const certificate = await Certificate.findById(id);
        if (!certificate) {
            return NextResponse.json(
                { message: "Certificate not found" },
                { status: 404 }
            );
        }

        // Delete associated files
        if (certificate.manufacturingCertificate?.fileUrl) {
            const manufacturingPath = path.join(process.cwd(), "public", certificate.manufacturingCertificate.fileUrl);
            try {
                await fs.unlink(manufacturingPath);
            } catch (err) {
                console.warn("Could not delete manufacturing file:", err);
            }
        }

        if (certificate.testCertificate?.fileUrl) {
            const testPath = path.join(process.cwd(), "public", certificate.testCertificate.fileUrl);
            try {
                await fs.unlink(testPath);
            } catch (err) {
                console.warn("Could not delete test file:", err);
            }
        }

        // Delete the certificate record
        await Certificate.findByIdAndDelete(id);

        void notifyDelete(NOTIFICATION_MODULES.PMS, "Certifications", id);

        return NextResponse.json(
            { message: "Certificate deleted successfully" },
            { status: 200 }
        );
    } catch (err) {
        console.error("Certificate deletion error:", err);
        return NextResponse.json(
            { message: err.message || "Deletion failed", error: err.message },
            { status: 500 }
        );
    }
}
