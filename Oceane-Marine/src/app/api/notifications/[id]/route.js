import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { isNotificationsAdmin } from "@/lib/notifications/isNotificationsAdmin";
import Notification from "@/lib/mongodb/models/Notification";

export async function PATCH(req, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const isRead = body.isRead !== false;

    const doc = await Notification.findByIdAndUpdate(
      id,
      { isRead },
      { new: true }
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: doc });
  } catch (err) {
    console.error("PATCH /api/notifications/[id]:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isNotificationsAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  try {
    const { id } = await params;
    const doc = await Notification.findByIdAndDelete(id).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/notifications/[id]:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
