/**
 * PMS module permission matrix (aligned with Operations / HR).
 *
 * Roles:
 *   admin    – view & download; see all forms; no create/edit/delete (submit disabled in UI)
 *   editor   – create / edit / delete PMS records + download
 *   approver – view & download (reserved for future flows)
 *   viewer   – read-only + download (default)
 */

export const PMS_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  APPROVER: "approver",
  VIEWER: "viewer",
};

const PERMISSIONS = {
  [PMS_ROLES.ADMIN]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isPmsAdmin: true,
  },
  [PMS_ROLES.EDITOR]: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canDownload: true,
    isPmsAdmin: false,
  },
  [PMS_ROLES.APPROVER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isPmsAdmin: false,
  },
  [PMS_ROLES.VIEWER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isPmsAdmin: false,
  },
};

export function getPmsPermissions(pmsRole) {
  return PERMISSIONS[pmsRole] || PERMISSIONS[PMS_ROLES.VIEWER];
}

export function isPmsAdminRole(pmsRole) {
  return pmsRole === PMS_ROLES.ADMIN;
}

export const VALID_PMS_ROLES = Object.values(PMS_ROLES);
