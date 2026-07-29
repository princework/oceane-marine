import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentDefect from "@/lib/mongodb/models/qhse-defect/EquipmentDefect";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

export async function POST(req) {
  await connectDB();

  try {
    const { equipmentDefect, base, actionRequired, targetDate } =
      await req.json();
    if (!equipmentDefect || !base || !actionRequired || !targetDate) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Serial year from target date (form field), not creation date
    const targetDateObj = new Date(targetDate);
    const year = !Number.isNaN(targetDateObj.getTime())
      ? targetDateObj.getFullYear()
      : new Date().getFullYear();
    const serialNumber = await getNextYearwiseSerial("EQUIPMENT_DEFECT", year);
    const formCode = getQhseFormCode("EQUIPMENT_DEFECT") || null;

    const newEquipmentDefect = await new EquipmentDefect({
      equipmentDefect,
      base,
      actionRequired,
      targetDate,
      formCode,
      serialNumber,
      status: "Open",
      createdBy: req.user?.id || null,
    }).save();

    return NextResponse.json(
      {
        message: "Equipment defect created successfully",
        data: newEquipmentDefect,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
