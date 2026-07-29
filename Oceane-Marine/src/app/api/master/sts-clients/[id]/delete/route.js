import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";

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
    const deleted = await MasterStsClient.findById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    await MasterStsClient.findByIdAndDelete(id);
    return NextResponse.json({ message: "Client deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
