import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StatutoryCertificate from "@/lib/mongodb/models/hr/StatutoryCertificate";
import OilMajor from "@/lib/mongodb/models/hr/OilMajor";
import PoacMatrix from "@/lib/mongodb/models/hr/PoacMatrix";
import Cid from "@/lib/mongodb/models/hr/Cid";
import { assertHrPermission } from "@/lib/auth/hrGuard";

export async function GET() {
  const guard = await assertHrPermission("canView");
  if (!guard.ok) return guard.response;

  try {
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    /* ========== STATUTORY CERTIFICATES ========== */
    const allCerts = await StatutoryCertificate.find({ status: "ACTIVE" }).lean();
    const totalCerts = allCerts.length;

    // Certificates expiring within 30 days
    const certsExpiringSoon = allCerts.filter(
      (c) => c.validity && new Date(c.validity) >= today && new Date(c.validity) <= thirtyDaysFromNow
    );

    // Overdue certificates (validity passed)
    const certsOverdue = allCerts.filter(
      (c) => c.validity && new Date(c.validity) < today
    );

    // Group certs by location
    const certsByLocation = {};
    allCerts.forEach((c) => {
      const loc = c.location || "Unknown";
      certsByLocation[loc] = (certsByLocation[loc] || 0) + 1;
    });

    // Group certs by typeOfDocs
    const certsByType = {};
    allCerts.forEach((c) => {
      const type = c.typeOfDocs || "Unknown";
      certsByType[type] = (certsByType[type] || 0) + 1;
    });

    /* ========== OIL MAJORS ========== */
    const allOilMajors = await OilMajor.find().lean();

    // Get latest per company (unique companies)
    const latestMap = new Map();
    const sortedOil = [...allOilMajors].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    for (const record of sortedOil) {
      const key = record.companyName.trim().toUpperCase();
      if (!latestMap.has(key)) {
        latestMap.set(key, record);
      }
    }
    const uniqueOilMajors = Array.from(latestMap.values());
    const totalOilMajors = uniqueOilMajors.length;

    // Group by status
    const oilMajorsByStatus = {
      Approved: 0,
      "Counterparty STS service provider": 0,
      "In Progress": 0,
    };
    uniqueOilMajors.forEach((r) => {
      if (oilMajorsByStatus[r.status] !== undefined) {
        oilMajorsByStatus[r.status]++;
      }
    });

    /* ========== POAC MATRIX ========== */
    const allPoac = await PoacMatrix.find({ status: "ACTIVE" }).lean();
    const totalPoacEntries = allPoac.length;
    const totalPoacPersonnel = allPoac.reduce(
      (sum, p) => sum + (p.rows ? p.rows.length : 0),
      0
    );

    // Unique STS service providers
    const providers = new Set();
    allPoac.forEach((p) => {
      (p.rows || []).forEach((row) => {
        if (row.stsServiceProvider) providers.add(row.stsServiceProvider.trim());
      });
    });

    /* ========== CID ========== */
    const allCid = await Cid.find({ status: "ACTIVE" }).lean();
    const totalCid = allCid.length;

    // CID expiring soon (within 30 days)
    const cidExpiringSoon = allCid.filter(
      (c) => c.validity && new Date(c.validity) >= today && new Date(c.validity) <= thirtyDaysFromNow
    );

    // CID overdue
    const cidOverdue = allCid.filter(
      (c) => c.validity && new Date(c.validity) < today
    );

    // CID by location
    const cidByLocation = {};
    allCid.forEach((c) => {
      const loc = c.location || "Unknown";
      cidByLocation[loc] = (cidByLocation[loc] || 0) + 1;
    });

    /* ========== UPCOMING RENEWALS (Statutory + CID combined) ========== */
    const upcomingRenewals = [];

    certsExpiringSoon.forEach((c) => {
      upcomingRenewals.push({
        type: "Statutory Certificate",
        name: c.typeOfDocs,
        location: c.location,
        validity: c.validity,
      });
    });

    cidExpiringSoon.forEach((c) => {
      upcomingRenewals.push({
        type: "CID",
        name: `${c.title} - ${c.name}`,
        location: c.location,
        validity: c.validity,
      });
    });

    // Sort by nearest expiry
    upcomingRenewals.sort(
      (a, b) => new Date(a.validity) - new Date(b.validity)
    );

    /* ========== OVERDUE ITEMS ========== */
    const overdueItems = [];

    certsOverdue.forEach((c) => {
      overdueItems.push({
        type: "Statutory Certificate",
        name: c.typeOfDocs,
        location: c.location,
        validity: c.validity,
      });
    });

    cidOverdue.forEach((c) => {
      overdueItems.push({
        type: "CID",
        name: `${c.title} - ${c.name}`,
        location: c.location,
        validity: c.validity,
      });
    });

    overdueItems.sort(
      (a, b) => new Date(a.validity) - new Date(b.validity)
    );

    return NextResponse.json({
      success: true,
      data: {
        // Summary counts
        totalCerts,
        certsExpiringSoon: certsExpiringSoon.length,
        certsOverdue: certsOverdue.length,
        totalOilMajors,
        oilMajorsByStatus,
        totalPoacEntries,
        totalPoacPersonnel,
        uniqueProviders: providers.size,
        totalCid,
        cidExpiringSoon: cidExpiringSoon.length,
        cidOverdue: cidOverdue.length,

        // Charts
        certsByLocation,
        certsByType,
        cidByLocation,

        // Tables
        upcomingRenewals: upcomingRenewals.slice(0, 10),
        overdueItems: overdueItems.slice(0, 10),
      },
    });
  } catch (error) {
    console.error("HR Dashboard Stats Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch HR statistics",
      },
      { status: 500 }
    );
  }
}
