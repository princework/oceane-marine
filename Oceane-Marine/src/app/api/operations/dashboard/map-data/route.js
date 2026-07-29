import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Location from "@/lib/mongodb/models/Location";

/* ================================================================
   COORDINATES LOOKUP  – fallback when Location doc has no lat/lng
   ================================================================ */

// Specific anchorage / OPL level coordinates
const COORDINATES_FALLBACK = {
  "Fujairah S  Anchorage":          { lat: 25.12,  lng: 56.36 },
  "Fujairah S Anchorage":           { lat: 25.12,  lng: 56.36 },
  "Fujairah G  Anchorage":          { lat: 25.14,  lng: 56.38 },
  "Fujairah G Anchorage":           { lat: 25.14,  lng: 56.38 },
  "Sohar E Anchorage":              { lat: 24.37,  lng: 56.73 },
  "Sohar C Anchorage":              { lat: 24.35,  lng: 56.71 },
  "Sohar D Anchorage":              { lat: 24.36,  lng: 56.72 },
  "Shinas OPL":                     { lat: 24.74,  lng: 56.46 },
  "PSQ Muscat":                     { lat: 23.63,  lng: 58.59 },
  "Muscat OPL":                     { lat: 23.61,  lng: 58.55 },
  "Muscat G Anchorage":             { lat: 23.60,  lng: 58.57 },
  "Muscat S Anchorage":             { lat: 23.59,  lng: 58.58 },
  "Salalah OPL":                    { lat: 16.94,  lng: 54.00 },
  "Salalah C Anchorage":            { lat: 16.95,  lng: 54.01 },
  "Duqm Anchorage":                 { lat: 19.66,  lng: 57.70 },
  "Dubai G Anchorage":              { lat: 25.26,  lng: 55.30 },
  "Dubai A Anchorage":              { lat: 25.25,  lng: 55.28 },
  "Dubai B Anchorage":              { lat: 25.27,  lng: 55.29 },
  "Dubai C Anchorage":              { lat: 25.24,  lng: 55.27 },
  "Dubai D Anchorage":              { lat: 25.23,  lng: 55.26 },
  "Khorfakkan A Anchorage":         { lat: 25.34,  lng: 56.36 },
  "Khorfakkan B Anchorage":         { lat: 25.35,  lng: 56.37 },
  "Khorfakkan C Anchorage":         { lat: 25.36,  lng: 56.38 },
  "Nacala anchorage":               { lat: -14.54, lng: 40.68 },
  "Male Anchorage":                 { lat: 4.17,   lng: 73.51 },
  "Khor Al Zubair":                 { lat: 30.27,  lng: 47.55 },
  "Yeosu S Anchorage":              { lat: 34.74,  lng: 127.74 },
  "Yeosu D-2 Anchorage":            { lat: 34.73,  lng: 127.73 },
  "Sri Lanka":                      { lat: 6.93,   lng: 79.85 },
  "Mombasa OPL":                    { lat: -4.04,  lng: 39.67 },
  "Nipah":                          { lat: 1.16,   lng: 103.75 },
  "Linggi":                         { lat: 2.39,   lng: 101.97 },
  "Tanjung Bruas H Anchorage":      { lat: 2.05,   lng: 102.14 },
  "Tanjung Bruas K Anchorage":      { lat: 2.04,   lng: 102.13 },
  "Tanjung Bruas M Anchorage":      { lat: 2.06,   lng: 102.15 },
};

// City-level fallback – used when the location name doesn't match a specific
// anchorage but starts with or equals one of these city/region names.
const CITY_FALLBACK = {
  "fujairah":       { lat: 25.13,  lng: 56.33 },
  "sohar":          { lat: 24.35,  lng: 56.73 },
  "shinas":         { lat: 24.74,  lng: 56.46 },
  "muscat":         { lat: 23.61,  lng: 58.55 },
  "salalah":        { lat: 16.95,  lng: 54.00 },
  "duqm":           { lat: 19.66,  lng: 57.70 },
  "dubai":          { lat: 25.25,  lng: 55.28 },
  "khorfakkan":     { lat: 25.35,  lng: 56.37 },
  "nacala":         { lat: -14.54, lng: 40.68 },
  "male":           { lat: 4.17,   lng: 73.51 },
  "khor al zubair": { lat: 30.27,  lng: 47.55 },
  "yeosu":          { lat: 34.74,  lng: 127.74 },
  "sri lanka":      { lat: 6.93,   lng: 79.85 },
  "mombasa":        { lat: -4.04,  lng: 39.67 },
  "nipah":          { lat: 1.16,   lng: 103.75 },
  "linggi":         { lat: 2.39,   lng: 101.97 },
  "tanjung bruas":  { lat: 2.05,   lng: 102.14 },
  "tanjung":        { lat: 2.05,   lng: 102.14 },
  "psq":            { lat: 23.63,  lng: 58.59 },
};

/** Resolve coordinates: DB fields → exact fallback → case-insensitive → city/partial match */
function resolveCoords(locationDoc) {
  if (!locationDoc) return null;

  // 1. Use DB fields if present
  if (locationDoc.latitude != null && locationDoc.longitude != null) {
    return { lat: locationDoc.latitude, lng: locationDoc.longitude };
  }

  const name = locationDoc.name?.trim();
  if (!name) return null;

  // 2. Exact match in fallback
  if (COORDINATES_FALLBACK[name]) return COORDINATES_FALLBACK[name];

  // 3. Case-insensitive exact match
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(COORDINATES_FALLBACK)) {
    if (key.toLowerCase() === lower) return coords;
  }

  // 4. City-level match: check if the location name starts with a known city
  for (const [city, coords] of Object.entries(CITY_FALLBACK)) {
    if (lower === city || lower.startsWith(city + " ") || lower.startsWith(city + "-")) {
      return coords;
    }
  }

  // 5. Reverse partial match: check if any fallback key starts with the location name
  for (const [key, coords] of Object.entries(COORDINATES_FALLBACK)) {
    if (key.toLowerCase().startsWith(lower)) return coords;
  }

  return null;
}

/* ================================================================
   GET  /api/operations/dashboard/map-data?year=2026&month=3
   Returns operation locations with coordinates and counts
   ================================================================ */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Build date filter
    const dateFilter = {};
    if (year) {
      const y = parseInt(year);
      if (month) {
        const m = parseInt(month);
        dateFilter.operationStartTime = {
          $gte: new Date(y, m - 1, 1),
          $lt:  new Date(y, m, 1),
        };
      } else {
        dateFilter.operationStartTime = {
          $gte: new Date(y, 0, 1),
          $lt:  new Date(y + 1, 0, 1),
        };
      }
    }

    const operations = await StsOperation.find({
      isLatest: true,
      ...dateFilter,
    })
      .populate("location", "name latitude longitude")
      .select("location operationStatus Operation_Ref_No chs ms operationStartTime")
      .lean();

    // Group by location
    const locationMap = {};

    for (const op of operations) {
      const locName = op.location?.name || "Unknown";
      const coords  = resolveCoords(op.location);

      if (!coords) continue; // skip locations we cannot place on map

      if (!locationMap[locName]) {
        locationMap[locName] = {
          name: locName,
          lat: coords.lat,
          lng: coords.lng,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          cancelled: 0,
          operations: [],
        };
      }

      const entry = locationMap[locName];
      entry.total++;

      const status = op.operationStatus || "Lined Up";
      if (status === "COMPLETED")  entry.completed++;
      else if (status === "INPROGRESS") entry.inProgress++;
      else if (status === "CANCELED")   entry.cancelled++;
      else entry.pending++;

      // Keep last 5 operations per location for tooltip
      if (entry.operations.length < 5) {
        entry.operations.push({
          refNo: op.Operation_Ref_No,
          status: op.operationStatus,
          chs: op.chs,
          ms: op.ms,
          date: op.operationStartTime,
        });
      }
    }

    const markers = Object.values(locationMap).sort((a, b) => b.total - a.total);

    return NextResponse.json({ success: true, data: markers });
  } catch (error) {
    console.error("Map data error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
