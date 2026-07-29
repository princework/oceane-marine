import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Certificate from "@/lib/mongodb/models/pms/Certificate";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET() {
    const guard = await assertPmsPermission("canView");
    if (!guard.ok) return guard.response;
    await connectDB();
    try {
        const certificates = await Certificate.find()
            .sort({ createdAt: -1 });
        return NextResponse.json({ success: true, data: certificates });
    } catch (error) {
        console.error("Certificate list error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
