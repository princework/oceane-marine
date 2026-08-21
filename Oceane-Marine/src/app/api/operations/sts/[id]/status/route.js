import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { releaseOperationResources } from "@/lib/operations/releaseOperationResources";

export async function PATCH(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const operation = await StsOperation.findById(id);
    if (!operation) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    if (operation.operationStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Operation already completed" },
        { status: 400 }
      );
    }

    // Release equipment + mooring master back to the pool before flipping the
    // status, so a failure here never leaves the operation marked COMPLETED
    // with resources still locked.
    const releasedEquipments = await releaseOperationResources({
      equipments: operation.equipments,
      mooringMaster: operation.mooringMaster,
    });

    operation.operationStatus = "COMPLETED";
    operation.operationEndTime = new Date();
    operation.equipments = releasedEquipments;
    await operation.save();

    return NextResponse.json({
      success: true,
      message: "Operation completed successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}