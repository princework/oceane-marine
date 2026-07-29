import { getSessionUser } from "@/lib/auth/getSessionUser";
import { createNotification } from "./createNotification";

export const NOTIFICATION_MODULES = {
  Operations: "Operations",
  PMS: "PMS",
  QHSE: "QHSE",
  HR: "HR",
};

export const NOTIFICATION_MODULE_LIST = Object.values(NOTIFICATION_MODULES);

export function isValidNotificationModule(m) {
  return NOTIFICATION_MODULE_LIST.includes(m);
}

/**
 * @param {keyof typeof NOTIFICATION_MODULES | string} module
 * @param {"CREATE"|"EDIT"|"DELETE"} action
 */
export async function notifyModuleRecord(module, action, submodule, recordId) {
  const user = await getSessionUser();
  await createNotification({
    user,
    action,
    module,
    submodule: submodule?.trim() || "",
    recordId,
  });
}

export async function notifyCreate(module, submodule, recordId) {
  await notifyModuleRecord(module, "CREATE", submodule, recordId);
}

export async function notifyEdit(module, submodule, recordId) {
  await notifyModuleRecord(module, "EDIT", submodule, recordId);
}

export async function notifyDelete(module, submodule, recordId) {
  await notifyModuleRecord(module, "DELETE", submodule, recordId);
}
