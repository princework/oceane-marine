"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { getQhsePermissions } from "@/lib/permissions/qhse";

/**
 * QHSE module permissions from `user.qhseRole` (defaults to viewer).
 */
export function useQhseRole() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.qhseRole || "viewer";
    const p = getQhsePermissions(role);
    return {
      role,
      user,
      canView: p.canView,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
      canDownload: p.canDownload,
      canApprove: p.canApprove,
      isQhseAdmin: p.isQhseAdmin,
      canCreateForm: p.canCreate,
      canEditForm: p.canEdit,
      canDeleteForm: p.canDelete,
    };
  }, [user]);
}
