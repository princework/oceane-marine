import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";
import { getNextYearwiseSerial } from "@/lib/mongodb/models/YearwiseSerialCounter";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";

/** Serial is generated from event date year (form field). */
export async function POST(req) {
  await connectDB();

  try {
    const { description, eventDate } = await req.json();

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!eventDate) {
      return NextResponse.json(
        { error: "Event date is required" },
        { status: 400 }
      );
    }

    // Serial year from event date (create form), not creation date
    const eventDateObj = new Date(eventDate);
    const year = !Number.isNaN(eventDateObj.getTime())
      ? eventDateObj.getFullYear()
      : new Date().getFullYear();
    const serialNumber = await getNextYearwiseSerial("BEST_PRACTICE", year);
    const formCode = getQhseFormCode("BEST_PRACTICE") || null;

    const newBestPractice = await new BestPractice({
      description: description.trim(),
      eventDate,
      formCode,
      serialNumber,
      createdBy: req.user?.id || null,
    }).save();

    return NextResponse.json(
      {
        message: "Best practice created successfully",
        data: newBestPractice,
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