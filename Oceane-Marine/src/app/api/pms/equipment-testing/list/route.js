import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import EquipmentTest from "@/lib/mongodb/models/pms/EquipmentTest";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req) {
    const guard = await assertPmsPermission("canView");
    if (!guard.ok) return guard.response;
    await connectDB();

    try {
        const { searchParams } = new URL(req.url);
        const year = parseInt(searchParams.get("year"));

        if (!year) {
            return NextResponse.json(
                { message: "Year is required" },
                { status: 400 }
            );
        }

        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year}-12-31`);

        const equipments = await Equipment.find({
            nextTestDate: { $gte: start, $lte: end },
            status: "ACTIVE"
        }).select(
            "serialCode equipmentCode equipmentType lastTestDate nextTestDate placedInOffice placedInBase placedInBay"
        );

        // Fetch planned tests for each equipment
        const equipmentIds = equipments.map(eq => eq._id);
        const plannedTests = await EquipmentTest.find({
            equipment: { $in: equipmentIds },
            status: "PLANNED"
        }).sort({ plannedOn: -1 });

        // Create a map of equipmentId -> latest planned test
        const testMap = {};
        plannedTests.forEach(test => {
            const eqId = test.equipment.toString();
            if (!testMap[eqId]) {
                testMap[eqId] = test;
            }
        });

        // Add planned test data to each equipment
        const equipmentsWithTests = equipments.map(eq => {
            const plannedTest = testMap[eq._id.toString()];
            return {
                ...eq.toObject(),
                plannedTest: plannedTest ? {
                    plannedOn: plannedTest.plannedOn,
                    tester: plannedTest.tester,
                    status: plannedTest.status,
                    _id: plannedTest._id
                } : null
            };
        });

        return NextResponse.json(
            { data: equipmentsWithTests },
            { status: 200 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
