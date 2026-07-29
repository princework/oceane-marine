import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { getHrPermissions } from "@/lib/permissions/hr";

export function hrUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function hrForbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * @returns {{ ok: true, user: object, hrRole: string, perms: object } | { ok: false, response: Response }}
 */
export async function requireHrSession() {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: hrUnauthorized() };
  const hrRole = user.hrRole || "viewer";
  const perms = getHrPermissions(hrRole);
  return { ok: true, user, hrRole, perms };
}

/**
 * @param {"canView"|"canCreate"|"canEdit"|"canDelete"|"canDownload"} perm
 */
export async function assertHrPermission(perm) {
  const session = await requireHrSession();
  if (!session.ok) return { ok: false, response: session.response };
  if (!session.perms[perm]) return { ok: false, response: hrForbidden() };
  return { ok: true, user: session.user, hrRole: session.hrRole, perms: session.perms };
}
