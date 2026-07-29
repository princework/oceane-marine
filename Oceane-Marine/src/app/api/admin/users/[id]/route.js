import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { VALID_HR_ROLES } from "@/lib/permissions/hr";
import { VALID_PMS_ROLES } from "@/lib/permissions/pms";
import { VALID_QHSE_ROLES } from "@/lib/permissions/qhse";

const VALID_OPS_ROLES = ["admin", "editor", "approver", "viewer"];

export async function GET(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.operationsRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const user = await User.findById(id, "-password").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("ADMIN GET USER ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.operationsRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const updates = {};
    if (body.employeeName) updates.employeeName = body.employeeName;
    if (body.email) updates.email = body.email;
    if (body.employeeId) updates.employeeId = body.employeeId;
    if (VALID_OPS_ROLES.includes(body.operationsRole)) {
      updates.operationsRole = body.operationsRole;
    }
    if (VALID_HR_ROLES.includes(body.hrRole)) {
      updates.hrRole = body.hrRole;
    }
    if (VALID_PMS_ROLES.includes(body.pmsRole)) {
      updates.pmsRole = body.pmsRole;
    }
    if (VALID_QHSE_ROLES.includes(body.qhseRole)) {
      updates.qhseRole = body.qhseRole;
    }
    if (typeof body.isActive === "boolean") {
      updates.isActive = body.isActive;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, select: "-password" }).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error("ADMIN UPDATE USER ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.operationsRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;

    if (String(sessionUser._id) === String(id)) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "User deleted" }, { status: 200 });
  } catch (error) {
    console.error("ADMIN DELETE USER ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
