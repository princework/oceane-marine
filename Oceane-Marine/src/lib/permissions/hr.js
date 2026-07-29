/**
 * HR module permission matrix (aligned with Operations roles).
 *
 * Roles:
 *   admin    – view & download only (oversight; no record changes)
 *   editor   – create / edit / delete HR records + download
 *   approver – view & download (reserved for future approval flows)
 *   viewer   – read-only + download (default)
 */

export const HR_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  APPROVER: "approver",
  VIEWER: "viewer",
};

const PERMISSIONS = {
  [HR_ROLES.ADMIN]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isHrAdmin: true,
  },
  [HR_ROLES.EDITOR]: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canDownload: true,
    isHrAdmin: false,
  },
  [HR_ROLES.APPROVER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isHrAdmin: false,
  },
  [HR_ROLES.VIEWER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    isHrAdmin: false,
  },
};

export function getHrPermissions(hrRole) {
  return PERMISSIONS[hrRole] || PERMISSIONS[HR_ROLES.VIEWER];
}

export function isHrAdminRole(hrRole) {
  return hrRole === HR_ROLES.ADMIN;
}

export const VALID_HR_ROLES = Object.values(HR_ROLES);
