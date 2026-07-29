import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MasterStsAgent from "@/lib/mongodb/models/MasterStsAgent";

export async function DELETE(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }
    await connectDB();
    const { id } = await params;
    const deleted = await MasterStsAgent.findById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    await MasterStsAgent.findByIdAndDelete(id);
    return NextResponse.json({ message: "Agent deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
