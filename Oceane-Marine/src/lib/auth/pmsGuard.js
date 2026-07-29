import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { getPmsPermissions } from "@/lib/permissions/pms";

export function pmsUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function pmsForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * @returns {{ ok: true, user: object, pmsRole: string, perms: object } | { ok: false, response: Response }}
 */
export async function requirePmsSession() {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: pmsUnauthorized() };
  const pmsRole = user.pmsRole || "viewer";
  const perms = getPmsPermissions(pmsRole);
  return { ok: true, user, pmsRole, perms };
}

/**
 * @param {"canView"|"canCreate"|"canEdit"|"canDelete"|"canDownload"} perm
 */
export async function assertPmsPermission(perm) {
  const session = await requirePmsSession();
  if (!session.ok) return { ok: false, response: session.response };
  if (!session.perms[perm]) return { ok: false, response: pmsForbidden() };
  return { ok: true, user: session.user, pmsRole: session.pmsRole, perms: session.perms };
}

/** PMS master-data routes that only the `admin` PMS role may access (see `getPmsPermissions`). */
export async function assertPmsAdmin() {
  const session = await requirePmsSession();
  if (!session.ok) return { ok: false, response: session.response };
  if (!session.perms.isPmsAdmin) return { ok: false, response: pmsForbidden() };
  return { ok: true, user: session.user, pmsRole: session.pmsRole, perms: session.perms };
}
