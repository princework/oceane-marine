/**
 * Users who may list / mark Operations notifications (extend when adding modules).
 */
export function isNotificationsAdmin(user) {
  if (!user) return false;
  return (
    user.roles?.includes("ADMIN") ||
    user.operationsRole === "admin" ||
    user.hrRole === "admin" ||
    user.pmsRole === "admin" ||
    user.qhseRole === "admin"
  );
}
