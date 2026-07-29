import { NOTIFICATION_MODULES, notifyEdit, notifyDelete } from "./moduleNotify";

export async function notifyOperationsEdit(submodule, recordId) {
  await notifyEdit(NOTIFICATION_MODULES.Operations, submodule, recordId);
}

export async function notifyOperationsDelete(submodule, recordId) {
  await notifyDelete(NOTIFICATION_MODULES.Operations, submodule, recordId);
}
