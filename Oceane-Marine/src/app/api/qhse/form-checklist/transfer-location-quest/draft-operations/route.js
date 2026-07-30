import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import TransferLocationQuestionnaire from "@/lib/mongodb/models/qhse-form-checklist/TransferLocationQuestionnaire";
import { assertQhsePermission } from "@/lib/auth/qhseGuard";

export const runtime = "nodejs";

/**
 * Draft operations for the "Send to Client" picker. Kept on the QHSE side
 * (queries StsOperation directly) rather than reusing the Operations
 * module's own list route, to avoid coupling QHSE UI to Operations' role
 * checks.
 */
export async function GET() {
  const guard = await assertQhsePermission("canCreate");
  if (!guard.ok) return guard.response;

  await connectDB();

  try {
    const operations = await StsOperation.find({
      operationStatus: "DRAFT",
      isLatest: true,
    })
      .select("Operation_Ref_No client transferLocationQuestSentAt transferLocationQuestSentTo")
      .sort({ createdAt: -1 })
      .lean();

    const refs = operations.map((op) => op.Operation_Ref_No).filter(Boolean);
    const questionnaires = await TransferLocationQuestionnaire.find({
      operationRef: { $in: refs },
    })
      .select("operationRef status")
      .lean();
    const statusByRef = new Map(questionnaires.map((q) => [q.operationRef, q.status]));

    const data = operations.map((op) => ({
      operationRef: op.Operation_Ref_No,
      client: op.client || "",
      transferLocationQuestSentAt: op.transferLocationQuestSentAt || null,
      transferLocationQuestSentTo: op.transferLocationQuestSentTo || null,
      questionnaireStatus: statusByRef.get(op.Operation_Ref_No) || null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Draft operations lookup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
