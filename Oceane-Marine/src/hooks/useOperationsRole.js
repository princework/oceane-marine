"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";

const PERMISSION_MAP = {
  admin: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: true,
    canApprove: false,
    isOpsAdmin: true,
  },
  editor: {
    canView: true,
    canCreateForm: true,
    canEditForm: true,
    canDeleteForm: true,
    canCreateCompatibility: true,
    canEditCompatibility: true,
    canDeleteCompatibility: true,
    canManageMasterData: false,
    canApprove: false,
    isOpsAdmin: false,
  },
  approver: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: false,
    canApprove: true,
    isOpsAdmin: false,
  },
  viewer: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: false,
    canApprove: false,
    isOpsAdmin: false,
  },
};

export function useOperationsRole() {
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    const role = user?.operationsRole || "viewer";
    const perms = PERMISSION_MAP[role] || PERMISSION_MAP.viewer;
    return { role, ...perms, user };
  }, [user]);
}
