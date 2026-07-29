import { connectDB } from "@/lib/config/connection";
import Notification from "@/lib/mongodb/models/Notification";

function actionVerb(action) {
  if (action === "DELETE") return "deleted";
  if (action === "EDIT") return "edited";
  if (action === "CREATE") return "created";
  return "updated";
}

/**
 * Central notification writer — call from API routes only (never from the client).
 *
 * @param {{
 *   user: { _id?: unknown, employeeName?: string, name?: string } | null,
 *   action: "CREATE" | "EDIT" | "DELETE",
 *   module: string,
 *   submodule?: string,
 *   recordId?: string | import("mongoose").Types.ObjectId,
 * }} params
 */
export async function createNotification({ user, action, module, submodule, recordId }) {
  try {
    await connectDB();
    const userName = user?.employeeName || user?.name || "Unknown";
    const userId = user?._id != null ? String(user._id) : "system";
    const sub = submodule?.trim() || "";
    const message = `${userName} ${actionVerb(action)} a record in ${module}${sub ? ` (${sub})` : ""}`;

    await Notification.create({
      userId,
      userName,
      action,
      module,
      submodule: sub,
      recordId: recordId != null ? String(recordId) : "",
      message,
      isRead: false,
    });
  } catch (err) {
    console.error("createNotification failed:", err.message);
  }
}
