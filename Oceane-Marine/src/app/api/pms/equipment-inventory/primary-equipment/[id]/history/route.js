import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req, { params }) {
    const guard = await assertPmsPermission("canView");
    if (!guard.ok) return guard.response;
    try {
        await connectDB();

        const { id: equipmentId } = await params;

        if (!equipmentId) {
            return NextResponse.json(
                { message: "Equipment ID is required" },
                { status: 400 }
            );
        }

        if (!mongoose.Types.ObjectId.isValid(equipmentId)) {
            return NextResponse.json(
                { message: "Invalid equipment id" },
                { status: 400 }
            );
        }

        // 🔥 Only STS operations where this equipment was used
        const operations = await StsOperation.find({
            "equipments.equipment": equipmentId
        })
            .populate("typeOfCargo", "name")
            .select(`
        Operation_Ref_No
        chs
        ms
        typeOfCargo
        operationStartTime
        client
        agent
        quantity
        equipments
      `)
            .sort({ operationStartTime: -1 })
            .lean();

        // 🔥 Shape data exactly for UI table
        const historyTable = [];

        operations.forEach(op => {
            const usage = op.equipments?.find(
                e => e.equipment?.toString() === equipmentId
            );

            historyTable.push({
                jobNo: op.Operation_Ref_No || "-",
                chs: op.chs || "-",
                ms: op.ms || "-",
                typeOfCargo: op.typeOfCargo?.name || "-",
                dateOfJob: op.operationStartTime,
                client: op.client || "-",
                agent: op.agent || "-",
                quantityCargo: op.quantity || 0,

                // optional (future use)
                usedHours: usage?.usedHours || 0,
                usageStatus: usage?.status || "RELEASED"
            });
        });

        return NextResponse.json({
            equipmentId,
            totalJobs: historyTable.length,
            records: historyTable
        });

    } catch (error) {
        console.error("Equipment History Error:", error);
        console.error("Error stack:", error.stack);
        return NextResponse.json(
            { 
                message: error.message || "Internal server error",
                error: process.env.NODE_ENV === "development" ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
