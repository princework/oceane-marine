import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { isNotificationsAdmin } from "@/lib/notifications/isNotificationsAdmin";
import {
  NOTIFICATION_MODULES,
  isValidNotificationModule,
} from "@/lib/notifications/moduleNotify";
import Notification from "@/lib/mongodb/models/Notification";

export async function GET(req) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ count: 0 });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({ count: 0 });
  }

  await connectDB();
  try {
    const { searchParams } = new URL(req.url);
    const moduleFilter = searchParams.get("module") || NOTIFICATION_MODULES.Operations;
    if (!isValidNotificationModule(moduleFilter)) {
      return NextResponse.json({ count: 0 });
    }
    const count = await Notification.countDocuments({
      module: moduleFilter,
      isRead: false,
    });
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
