import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";
import bcrypt from "bcryptjs";
import {
  normalizePublicSignupLegacyRole,
  getModuleRolesForSignupLegacyRole,
} from "@/lib/auth/signupRoleDefaults";

export async function POST(req) {
  await connectDB();
  const body = await req.json();
  const { employeeId, employeeName, email, password, role } = body;

  try {
    if (!employeeId?.trim() || !employeeName?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "employeeId, employeeName, email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: email.trim() });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const legacyRole = normalizePublicSignupLegacyRole(role);
    const moduleRoles = getModuleRolesForSignupLegacyRole(legacyRole);

    const newUser = await User.create({
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      roles: [legacyRole],
      ...moduleRoles,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    return NextResponse.json(
      { message: "User created successfully", user: userObj },
      { status: 201 }
    );
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
