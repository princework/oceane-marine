import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import Compatibility from "@/lib/mongodb/models/operations/Compatibility";
import { computeHose, computeFender } from "@/app/operations/sts-operations/new/compatibility/calculations";

export async function POST(req) {
  await connectDB();
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.operationsRole !== "editor") {
      return NextResponse.json({ error: "Forbidden: Editor role required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      operationRef,
      operationNumber,
      year,
      locationId,
      locationName,
      STBL,
      SS,
      section,
    } = body;

    if (!operationNumber || !year) {
      return NextResponse.json(
        { error: "Operation number and year are required" },
        { status: 400 }
      );
    }

    const stbl = STBL || {};
    const ss = SS || {};
    let results = {};
    if (section === "fender") {
      results.fender = computeFender(stbl, ss);
    } else {
      results.hose = computeHose(stbl, ss);
    }

    const doc = await Compatibility.create({
      operationRef: operationRef || null,
      operationNumber: String(operationNumber).trim(),
      year: Number(year),
      location: {
        locationId: locationId || null,
        name: locationName != null ? String(locationName) : "",
      },
      STBL: stbl,
      SS: ss,
      results,
    });

    return NextResponse.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
