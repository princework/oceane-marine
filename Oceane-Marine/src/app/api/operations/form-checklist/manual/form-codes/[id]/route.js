import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import ManualFormCode from "@/lib/mongodb/models/operations-form-checklist/ManualFormCode";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { notifyOperationsEdit, notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export async function DELETE(req, { params }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.operationsRole !== "admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Operations admin required" },
      { status: 403 }
    );
  }

  await connectDB();
  try {
    const { id } = await params;
    const record = await ManualFormCode.findByIdAndDelete(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Form code not found" },
        { status: 404 }
      );
    }
    void notifyOperationsDelete("Manual Form Codes", id);
    return NextResponse.json({ success: true, message: "Form code deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
