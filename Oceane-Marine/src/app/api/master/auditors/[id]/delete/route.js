import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterAuditor from "@/lib/mongodb/models/MasterAuditor";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export async function DELETE(req, { params }) {
  const guard = await assertQhsePermission("canDelete");
  if (!guard.ok) return guard.response;

  await connectDB();
  try {
    const { id } = await params;
    const deleted = await MasterAuditor.findById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Auditor not found" }, { status: 404 });
    }
    await MasterAuditor.findByIdAndDelete(id);
    return NextResponse.json({ message: "Auditor deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
