import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { getQhsePermissions } from "@/lib/permissions/qhse";

export function qhseUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function qhseForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * @returns {{ ok: true, user: object, qhseRole: string, perms: object } | { ok: false, response: Response }}
 */
export async function requireQhseSession() {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: qhseUnauthorized() };
  const qhseRole = user.qhseRole || "viewer";
  const perms = getQhsePermissions(qhseRole);
  return { ok: true, user, qhseRole, perms };
}

/**
 * @param {"canView"|"canCreate"|"canEdit"|"canDelete"|"canDownload"|"canApprove"} perm
 */
export async function assertQhsePermission(perm) {
  const session = await requireQhseSession();
  if (!session.ok) return { ok: false, response: session.response };
  if (!session.perms[perm]) return { ok: false, response: qhseForbidden() };
  return { ok: true, user: session.user, qhseRole: session.qhseRole, perms: session.perms };
}

/**
 * Restricted to the QHSE `admin` role only — used for master-data registers
 * (Vendor Register, Auditor Register) mirroring Operations' admin-only
 * master data, which sits outside the regular create/edit/delete matrix.
 */
export async function assertQhseAdmin() {
  const session = await requireQhseSession();
  if (!session.ok) return { ok: false, response: session.response };
  if (!session.perms.isQhseAdmin) return { ok: false, response: qhseForbidden() };
  return { ok: true, user: session.user, qhseRole: session.qhseRole, perms: session.perms };
}
