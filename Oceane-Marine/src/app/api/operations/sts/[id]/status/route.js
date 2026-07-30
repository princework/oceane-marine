import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import MooringMaster from "@/lib/mongodb/models/MooringMaster";

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
    // 1. Update operation
    operation.operationStatus = "COMPLETED";
    operation.operationEndTime = new Date();
    await operation.save();

    // 2. Release equipments
    for (const eq of operation.equipments || []) {
      if (eq.status === "IN_USE") {
        const hours = (now.getTime() - new Date(eq.startTime).getTime()) / 36e5;

        // Only primary equipment carries the in-use lock that create/route.js
        // sets. Accessories are never locked, so there's nothing to unlock —
        // their usage entry is still closed out below.
        if ((eq.equipmentSource || "Equipment") === "Equipment") {
          await Equipment.findByIdAndUpdate(eq.equipment, {
            $inc: { quantityTransferred: 1 },
            isInUse: false,
            lastUsedAt: new Date(),
          });
        }

        eq.endTime = now;
        eq.usedHours = hours;
        eq.status = "RELEASED";
      }
    }

    await operation.save();

    // 3. Release mooring master
    if (operation.mooringMaster) {
      await MooringMaster.findByIdAndUpdate(operation.mooringMaster, {
        availability: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Operation completed successfully",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}