/**
 * Operations module permission matrix.
 *
 * Roles:
 *   admin    – manage master data (cargo types, locations, mooring masters)
 *   editor   – create / edit / delete STS forms, compatibility, checklists
 *   approver – approve forms where approval buttons exist
 *   viewer   – read-only access (default for everyone)
 */

const OPS_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  APPROVER: "approver",
  VIEWER: "viewer",
};

const PERMISSIONS = {
  [OPS_ROLES.ADMIN]: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: true,
    canApprove: false,
  },
  [OPS_ROLES.EDITOR]: {
    canView: true,
    canCreateForm: true,
    canEditForm: true,
    canDeleteForm: true,
    canCreateCompatibility: true,
    canEditCompatibility: true,
    canDeleteCompatibility: true,
    canManageMasterData: false,
    canApprove: false,
  },
  [OPS_ROLES.APPROVER]: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: false,
    canApprove: true,
  },
  [OPS_ROLES.VIEWER]: {
    canView: true,
    canCreateForm: false,
    canEditForm: false,
    canDeleteForm: false,
    canCreateCompatibility: false,
    canEditCompatibility: false,
    canDeleteCompatibility: false,
    canManageMasterData: false,
    canApprove: false,
  },
};

export function getOpsPermissions(operationsRole) {
  return PERMISSIONS[operationsRole] || PERMISSIONS[OPS_ROLES.VIEWER];
}

export function isOpsAdmin(operationsRole) {
  return operationsRole === OPS_ROLES.ADMIN;
}

export { OPS_ROLES };
export default PERMISSIONS;
