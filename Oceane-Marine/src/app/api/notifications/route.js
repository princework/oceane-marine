import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { isNotificationsAdmin } from "@/lib/notifications/isNotificationsAdmin";
import {
  NOTIFICATION_MODULES,
  isValidNotificationModule,
} from "@/lib/notifications/moduleNotify";
import Notification from "@/lib/mongodb/models/Notification";

/**
 * GET /api/notifications?module=Operations|PMS|QHSE|HR&limit=20
 */
export async function GET(req) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10))
    );
    const moduleFilter = searchParams.get("module") || NOTIFICATION_MODULES.Operations;

    if (!isValidNotificationModule(moduleFilter)) {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }

    const filter = { module: moduleFilter };

    const [items, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (err) {
    console.error("GET /api/notifications:", err);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
