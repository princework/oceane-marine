import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import EquipmentTest from "@/lib/mongodb/models/pms/EquipmentTest";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";
import { NOTIFICATION_MODULES, notifyCreate } from "@/lib/notifications/moduleNotify";

export async function POST(req) {
    const guard = await assertPmsPermission("canCreate");
    if (!guard.ok) return guard.response;
    await connectDB();

    try {
        const { equipmentId, plannedOn, tester } = await req.json();

        if (!equipmentId || !plannedOn || !tester) {
            return NextResponse.json(
                { message: "All fields are required" },
                { status: 400 }
            );
        }

        const equipment = await Equipment.findById(equipmentId);

        if (!equipment) {
            return NextResponse.json(
                { message: "Equipment not found" },
                { status: 404 }
            );
        }

        const test = await EquipmentTest.create({
            equipment: equipmentId,
            plannedOn,
            tester
        });

        void notifyCreate(NOTIFICATION_MODULES.PMS, "Equipment Testing", test._id);

        return NextResponse.json(
            { message: "Test plan created", data: test },
            { status: 201 }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
