import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/config/connection";
import User from "@/lib/mongodb/models/User";

/**
 * Reads the JWT from cookies and returns the full user document (minus password).
 * Returns null when the token is missing / invalid / user not found.
 */
export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await connectDB();

    const user = await User.findById(decoded.id).lean();
    if (!user) return null;

    delete user.password;
    return user;
  } catch {
    return null;
  }
}

/**
 * Convenience: returns { user, operationsRole, permissions }.
 * `permissions` is the resolved operations permission object.
 */
export async function getSessionUserWithOpsPerms() {
  const { getOpsPermissions } = await import("@/lib/permissions/operations");
  const user = await getSessionUser();
  if (!user) return { user: null, operationsRole: null, permissions: null };

  const operationsRole = user.operationsRole || "viewer";
  const permissions = getOpsPermissions(operationsRole);
  return { user, operationsRole, permissions };
}
