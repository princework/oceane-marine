import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { VALID_HR_ROLES } from "@/lib/permissions/hr";
import { VALID_PMS_ROLES } from "@/lib/permissions/pms";
import { VALID_QHSE_ROLES } from "@/lib/permissions/qhse";

const VALID_OPS_ROLES = ["admin", "editor", "approver", "viewer"];

export async function POST(req) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.operationsRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();
    const { employeeId, employeeName, email, password, operationsRole, hrRole, pmsRole, qhseRole } = await req.json();

    if (!employeeId || !employeeName || !email || !password) {
      return NextResponse.json(
        { error: "employeeId, employeeName, email and password are required" },
        { status: 400 }
      );
    }

    const existing = await User.findOne({
      $or: [{ email }, { employeeId }],
    });
    if (existing) {
      return NextResponse.json({ error: "User with this email or employeeId already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = VALID_OPS_ROLES.includes(operationsRole) ? operationsRole : "viewer";
    const hr = VALID_HR_ROLES.includes(hrRole) ? hrRole : "viewer";
    const pms = VALID_PMS_ROLES.includes(pmsRole) ? pmsRole : "viewer";
    const qhse = VALID_QHSE_ROLES.includes(qhseRole) ? qhseRole : "viewer";

    const newUser = await User.create({
      employeeId,
      employeeName,
      email,
      password: hashedPassword,
      operationsRole: role,
      hrRole: hr,
      pmsRole: pms,
      qhseRole: qhse,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    return NextResponse.json({ success: true, user: userObj }, { status: 201 });
  } catch (error) {
    console.error("ADMIN CREATE USER ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
