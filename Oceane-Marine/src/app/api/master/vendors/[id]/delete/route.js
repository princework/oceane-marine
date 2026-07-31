import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import MasterVendor from "@/lib/mongodb/models/MasterVendor";
import { assertQhseAdmin } from "@/lib/auth/qhseGuard";

export async function DELETE(req, { params }) {
  const guard = await assertQhseAdmin();
  if (!guard.ok) return guard.response;

  await connectDB();
  try {
    const { id } = await params;
    const deleted = await MasterVendor.findById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    await MasterVendor.findByIdAndDelete(id);
    return NextResponse.json({ message: "Vendor deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
