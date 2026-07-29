import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { isNotificationsAdmin } from "@/lib/notifications/isNotificationsAdmin";
import {
  NOTIFICATION_MODULE_LIST,
  isValidNotificationModule,
} from "@/lib/notifications/moduleNotify";
import Notification from "@/lib/mongodb/models/Notification";

export async function POST(req) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  try {
    const body = await req.json().catch(() => ({}));
    const moduleFilter = body.module;

    if (moduleFilter === "all") {
      await Notification.updateMany(
        { module: { $in: NOTIFICATION_MODULE_LIST }, isRead: false },
        { $set: { isRead: true } }
      );
      return NextResponse.json({ success: true });
    }

    if (!moduleFilter || !isValidNotificationModule(moduleFilter)) {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }

    await Notification.updateMany(
      { module: moduleFilter, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/notifications/mark-read:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
