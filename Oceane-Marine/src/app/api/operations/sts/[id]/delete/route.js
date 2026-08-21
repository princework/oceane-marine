import { NextResponse } from "next/server";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { connectDB } from "@/lib/config/connection";
import { notifyOperationsDelete } from "@/lib/notifications/operationsNotified";
import { releaseOperationResources } from "@/lib/operations/releaseOperationResources";

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const userOperation = await StsOperation.findById(id);
    if (!userOperation) {
      return NextResponse.json(
        { success: false, error: "Operation not found" },
        { status: 404 }
      );
    }

    if (!userOperation.isLatest) {
      return NextResponse.json(
        { success: false, error: "Only latest version can be deleted" },
        { status: 403 }
      );
    }

    // Deleting the operation must not leave its equipment/accessories/mooring
    // master stuck locked forever. Skipped for an already-COMPLETED operation —
    // its resources were released on completion, and re-releasing here could
    // steal one back from a different operation that has since picked it up.
    if (userOperation.operationStatus !== "COMPLETED") {
      await releaseOperationResources({
        equipments: userOperation.equipments,
        mooringMaster: userOperation.mooringMaster,
      });
    }

    await StsOperation.deleteMany({
      parentOperationId: userOperation.parentOperationId,
    });

    void notifyOperationsDelete("STS Operations", id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
