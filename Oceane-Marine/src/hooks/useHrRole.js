"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { getHrPermissions } from "@/lib/permissions/hr";

/**
 * HR module permissions from `user.hrRole` (defaults to viewer).
 * Mirrors useOperationsRole naming where helpful for forms/lists.
 */
export function useHrRole() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.hrRole || "viewer";
    const p = getHrPermissions(role);
    return {
      role,
      user,
      canView: p.canView,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
      canDownload: p.canDownload,
      isHrAdmin: p.isHrAdmin,
      /** Aliases aligned with Operations hook */
      canCreateForm: p.canCreate,
      canEditForm: p.canEdit,
      canDeleteForm: p.canDelete,
    };
  }, [user]);
}
