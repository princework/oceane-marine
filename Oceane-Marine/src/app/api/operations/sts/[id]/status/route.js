import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { releaseOperationResources } from "@/lib/operations/releaseOperationResources";

/** Which current statuses may move to which terminal status, via the Operation module's action buttons. */
const ALLOWED_SOURCE_STATUSES = {
  COMPLETED: ["INPROGRESS"],
  CANCELED: ["Lined Up", "INPROGRESS"],
};

export async function PATCH(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const status = body?.status;

    if (!ALLOWED_SOURCE_STATUSES[status]) {
      return NextResponse.json(
        { error: 'status must be "COMPLETED" or "CANCELED"' },
        { status: 400 }
      );
    }

    const operation = await StsOperation.findById(id);
    if (!operation) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    if (!ALLOWED_SOURCE_STATUSES[status].includes(operation.operationStatus)) {
      return NextResponse.json(
        {
          error: `Cannot mark ${status.toLowerCase()} from ${operation.operationStatus}. Allowed from: ${ALLOWED_SOURCE_STATUSES[status].join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Release equipment + mooring master back to the pool before flipping the
    // status, so a failure here never leaves the operation marked terminal
    // with resources still locked.
    const releasedEquipments = await releaseOperationResources({
      equipments: operation.equipments,
      mooringMaster: operation.mooringMaster,
    });

    operation.operationStatus = status;
    operation.operationEndTime = new Date();
    operation.equipments = releasedEquipments;
    await operation.save();

    return NextResponse.json({
      success: true,
      message:
        status === "COMPLETED"
          ? "Operation completed successfully"
          : "Operation cancelled successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}