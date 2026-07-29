import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { isNotificationsAdmin } from "@/lib/notifications/isNotificationsAdmin";
import { NOTIFICATION_MODULE_LIST } from "@/lib/notifications/moduleNotify";
import Notification from "@/lib/mongodb/models/Notification";

/**
 * GET /api/notifications/unread-summary
 * Returns unread counts per module for the admin bell badge + tab dots.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({
      success: true,
      byModule: {},
      total: 0,
    });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({
      success: true,
      byModule: {},
      total: 0,
    });
  }

  await connectDB();
  try {
    const rows = await Notification.aggregate([
      { $match: { isRead: false, module: { $in: NOTIFICATION_MODULE_LIST } } },
      { $group: { _id: "$module", count: { $sum: 1 } } },
    ]);

    const byModule = {};
    for (const m of NOTIFICATION_MODULE_LIST) {
      byModule[m] = 0;
    }
    let total = 0;
    for (const r of rows) {
      if (r._id && byModule[r._id] !== undefined) {
        byModule[r._id] = r.count;
        total += r.count;
      }
    }

    return NextResponse.json({ success: true, byModule, total });
  } catch (err) {
    console.error("unread-summary:", err);
    return NextResponse.json({
      success: true,
      byModule: {},
      total: 0,
    });
  }
}
