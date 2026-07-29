"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { getPmsPermissions } from "@/lib/permissions/pms";

/**
 * PMS module permissions from `user.pmsRole` (defaults to viewer).
 */
export function usePmsRole() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.pmsRole || "viewer";
    const p = getPmsPermissions(role);
    return {
      role,
      user,
      canView: p.canView,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
      canDownload: p.canDownload,
      isPmsAdmin: p.isPmsAdmin,
      canCreateForm: p.canCreate,
      canEditForm: p.canEdit,
      canDeleteForm: p.canDelete,
    };
  }, [user]);
}
