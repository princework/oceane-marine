/**
 * QHSE module permission matrix (aligned with Operations / HR / PMS).
 *
 * Roles:
 *   admin    – view & download; see all forms; no create/edit/delete/approve
 *   editor   – create / edit / delete QHSE records + download (no approve)
 *   approver – view & download + approve; no create/edit/delete
 *   viewer   – read-only + download (default)
 */

export const QHSE_ROLES = {
  ADMIN: "admin",
  EDITOR: "editor",
  APPROVER: "approver",
  VIEWER: "viewer",
};

const PERMISSIONS = {
  [QHSE_ROLES.ADMIN]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    canApprove: false,
    isQhseAdmin: true,
  },
  [QHSE_ROLES.EDITOR]: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canDownload: true,
    canApprove: false,
    isQhseAdmin: false,
  },
  [QHSE_ROLES.APPROVER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    canApprove: true,
    isQhseAdmin: false,
  },
  [QHSE_ROLES.VIEWER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canDownload: true,
    canApprove: false,
    isQhseAdmin: false,
  },
};

export function getQhsePermissions(qhseRole) {
  return PERMISSIONS[qhseRole] || PERMISSIONS[QHSE_ROLES.VIEWER];
}

export function isQhseAdminRole(qhseRole) {
  return qhseRole === QHSE_ROLES.ADMIN;
}

export const VALID_QHSE_ROLES = Object.values(QHSE_ROLES);
