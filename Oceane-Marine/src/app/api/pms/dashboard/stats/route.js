import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Equipment from "@/lib/mongodb/models/pms/Equipment";
import WarehouseManagement from "@/lib/mongodb/models/pms/WarehouseManagement";
import EquipmentTest from "@/lib/mongodb/models/pms/EquipmentTest";
import Accessories from "@/lib/mongodb/models/pms/Accessories";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { assertPmsPermission } from "@/lib/auth/pmsGuard";

export async function GET(req) {
  const guard = await assertPmsPermission("canView");
  if (!guard.ok) return guard.response;
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /* ========== WAREHOUSE DATA ========== */
    const warehouseFilter = { isDeleted: false };
    if (location) warehouseFilter.location = location.trim();

    const warehouseData = await WarehouseManagement.find(warehouseFilter)
      .sort({ startDate: -1 })
      .lean();

    const totalHoses = warehouseData.reduce((s, i) => s + (i.hoses || 0), 0);
    const totalPrimaryFenders = warehouseData.reduce((s, i) => s + (i.primaryFenders || 0), 0);
    const totalSecondaryFenders = warehouseData.reduce((s, i) => s + (i.secondaryFenders || 0), 0);

    /* ========== EQUIPMENT DATA ========== */
    const allEquipment = await Equipment.find({ status: { $ne: "RETIRED" } }).lean();

    // Group by equipmentType for donut chart
    const equipmentByType = {};
    allEquipment.forEach((eq) => {
      const type = eq.equipmentType || "Other";
      equipmentByType[type] = (equipmentByType[type] || 0) + 1;
    });

    // Total counts
    const totalEquipment = allEquipment.length;
    const activeEquipment = allEquipment.filter((e) => e.status === "ACTIVE").length;
    const inUseEquipment = allEquipment.filter((e) => e.isInUse).length;

    /* ========== UPCOMING TEST / OVERDUE ========== */
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingTestDue = allEquipment.filter(
      (eq) =>
        eq.nextTestDate &&
        new Date(eq.nextTestDate) >= today &&
        new Date(eq.nextTestDate) <= thirtyDaysFromNow
    ).length;

    const overdueEquipment = allEquipment.filter(
      (eq) => eq.nextTestDate && new Date(eq.nextTestDate) < today
    ).length;

    const overdueTests = await EquipmentTest.countDocuments({ status: "OVERDUE" });
    const totalOverdue = overdueEquipment + overdueTests;

    /* ========== RETIREMENT ========== */
    const retiredEquipment = await Equipment.find({ status: "RETIRED" })
      .select("equipmentType")
      .lean();
    const retirementByType = {};
    retiredEquipment.forEach((eq) => {
      const type = eq.equipmentType || "Unknown";
      retirementByType[type] = (retirementByType[type] || 0) + 1;
    });

    /* ========== EQUIPMENT BY LOCATION (warehouse records — keys match PMS Location names) ========== */
    const distinctWarehouseLocs = [
      ...new Set(warehouseData.map((item) => item.location).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b)));
    const equipmentByLocation = {};
    distinctWarehouseLocs.forEach((loc) => {
      const locData = warehouseData.filter((item) => item.location === loc);
      if (locData.length > 0) {
        equipmentByLocation[loc] = {
          primaryFenders: locData.reduce((s, i) => s + (i.primaryFenders || 0), 0),
          secondaryFenders: locData.reduce((s, i) => s + (i.secondaryFenders || 0), 0),
          hoses: locData.reduce((s, i) => s + (i.hoses || 0), 0),
        };
      }
    });

    /* ========== SPARE USAGE (ACCESSORIES - OCCASIONAL) ========== */
    const spares = await Accessories.find({
      isDeleted: { $ne: true },
      category: "OCCASIONAL",
    })
      .select("equipmentName quantity status")
      .lean();

    /* ========== EQUIPMENT CURRENTLY IN USE (from STS Operations) ========== */
    const inUseOps = await StsOperation.find({
      isLatest: true,
      "equipments.status": "IN_USE",
    })
      .populate("equipments.equipment", "equipmentCode equipmentName equipmentType")
      .populate("location", "locationName")
      .select(
        "Operation_Ref_No operationStartTime equipments location operationStatus"
      )
      .sort({ operationStartTime: -1 })
      .limit(20)
      .lean();

    // Flatten into rows
    const equipmentInUse = [];
    inUseOps.forEach((op) => {
      const inUseItems = (op.equipments || []).filter(
        (e) => e.status === "IN_USE"
      );
      inUseItems.forEach((item) => {
        equipmentInUse.push({
          date: op.operationStartTime,
          operationRef: op.Operation_Ref_No,
          equipmentName: item.equipment?.equipmentName || "—",
          equipmentCode: item.equipment?.equipmentCode || "—",
          equipmentType: item.equipment?.equipmentType || "—",
          location: op.location?.locationName || "—",
          startTime: item.startTime,
        });
      });
    });

    /* ========== CURRENT WAREHOUSE MOVEMENTS ========== */
    const activeMovements = await WarehouseManagement.find({
      isDeleted: false,
      status: "NOT_COMPLETED",
      fromLocation: { $exists: true, $ne: "" },
      toLocation: { $exists: true, $ne: "" },
    })
      .sort({ startDate: -1 })
      .limit(10)
      .lean();

    const warehouseMovements = activeMovements.map((m) => ({
      _id: m._id,
      equipment: m.equipment,
      equipmentType: m.equipmentType,
      nos: m.nos,
      fromLocation: m.fromLocation,
      stopover: m.stopover,
      toLocation: m.toLocation,
      startDate: m.startDate,
      estimatedEndDate: m.estimatedEndDate,
    }));

    /* ========== EQUIPMENT TESTS STATS ========== */
    const plannedTests = await EquipmentTest.countDocuments({ status: "PLANNED" });
    const completedTests = await EquipmentTest.countDocuments({ status: "COMPLETED" });

    return NextResponse.json({
      success: true,
      data: {
        // Summary cards
        totalEquipment,
        activeEquipment,
        inUseEquipment,
        upcomingTestDue,
        overdue: totalOverdue,
        plannedTests,
        completedTests,

        // Fenders & Hoses
        hoses: { total: totalHoses },
        fenders: {
          primary: totalPrimaryFenders,
          secondary: totalSecondaryFenders,
          total: totalPrimaryFenders + totalSecondaryFenders,
        },

        // Chart data
        equipmentByType,
        retirement: retirementByType,
        equipmentByLocation,

        // Tables
        spares,
        equipmentInUse,
        warehouseMovements,
      },
    });
  } catch (error) {
    console.error("PMS Dashboard Stats Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch PMS statistics",
      },
      { status: 500 }
    );
  }
}
