import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import Jpo from "@/lib/mongodb/models/operations-form-checklist/Jpo";
import RiskAssessment from "@/lib/mongodb/models/qhse-risk-assessment/RiskAssessment";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Location from "@/lib/mongodb/models/Location";

/**
 * Extract city/region name from location name (e.g., "Dubai G Anchorage" → "Dubai")
 */
function extractCityName(locationName) {
  if (!locationName) return "";
  const name = locationName.trim();
  
  // Common patterns: "City X Anchorage", "City OPL", "City Y Anchorage"
  // Try to extract the base city name
  const cityPatterns = [
    /^(Dubai|Fujairah|Sohar|Muscat|Salalah|Duqm|Khorfakkan|Nacala|Mombasa|Male|Yeosu|Nipah|Linggi|Tanjung|Shinas|PSQ)\s/i,
    /^(Sri Lanka|Khor Al Zubair)/i,
  ];
  
  for (const pattern of cityPatterns) {
    const match = name.match(pattern);
    if (match) return match[1];
  }
  
  // If no pattern matches, return the original name
  return name;
}

/**
 * GET /api/operations/sts/pre-sts-docs?locationId=xxx&locationName=xxx
 *
 * Returns:
 *  - jpo              : latest JPO file path for the location
 *  - riskAssessment   : latest Risk Assessment file path (kept for backward compat)
 *  - riskAssessments  : ALL Risk Assessments for the location
 *  - nearMissReports  : ALL Near Miss reports linked to operations at this location
 */
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("locationId");
    const locationName = searchParams.get("locationName");

    if (!locationId && !locationName) {
      return NextResponse.json(
        { error: "locationId or locationName is required" },
        { status: 400 }
      );
    }

    const result = {
      jpo: null,
      riskAssessment: null,
      riskAssessments: [],
      nearMissReports: [],
    };

    // Get the actual location document to find related locations (same city)
    let selectedLocation = null;
    let cityName = "";
    let relatedLocationIds = [];

    if (locationId) {
      selectedLocation = await Location.findById(locationId).lean();
      if (selectedLocation) {
        cityName = extractCityName(selectedLocation.name);
        // Find all locations in the same city/region
        const allLocations = await Location.find().lean();
        relatedLocationIds = allLocations
          .filter((loc) => {
            const locCity = extractCityName(loc.name);
            return locCity && locCity.toLowerCase() === cityName.toLowerCase();
          })
          .map((loc) => loc._id);
        // Always include the selected location itself
        if (!relatedLocationIds.includes(locationId)) {
          relatedLocationIds.push(locationId);
        }
      }
    } else if (locationName) {
      cityName = extractCityName(locationName);
    }

    // ── JPO (latest) ────────────────────────────────────────
    // Try exact match first, then city-level match
    if (locationId) {
      let latestJpo = await Jpo.findOne({
        "location.locationId": locationId,
      })
        .sort({ uploadedAt: -1 })
        .lean();

      // If not found and we have related locations, try matching by city
      if (!latestJpo && relatedLocationIds.length > 0) {
        latestJpo = await Jpo.findOne({
          "location.locationId": { $in: relatedLocationIds },
        })
          .sort({ uploadedAt: -1 })
          .lean();
      }

      // If still not found, try matching by location name (city-level)
      if (!latestJpo && cityName) {
        const cityRegex = new RegExp(`^${cityName}\\s`, "i");
        latestJpo = await Jpo.findOne({
          $or: [
            { "location.name": { $regex: cityRegex } },
            { "location.name": { $regex: new RegExp(`^${cityName}$`, "i") } },
          ],
        })
          .sort({ uploadedAt: -1 })
          .lean();
      }

      if (latestJpo?.filePath) {
        result.jpo = latestJpo.filePath;
      }
    }

    // ── Risk Assessments (ALL for this location) ────────────
    // Use fuzzy matching: exact match OR city-level match
    if (locationName || cityName) {
      const searchName = locationName || "";
      const searchCity = cityName || extractCityName(searchName);

      // Build query: exact match OR city-level match
      const query = {
        $or: [
          { locationName: searchName }, // Exact match
          { locationName: { $regex: new RegExp(`^${searchCity}\\s`, "i") } }, // Starts with city name
          { locationName: { $regex: new RegExp(`^${searchCity}$`, "i") } }, // Exact city match
        ],
      };

      // If we have a selected location, also try matching by related location names
      if (selectedLocation && relatedLocationIds.length > 0) {
        const relatedLocations = await Location.find({
          _id: { $in: relatedLocationIds },
        })
          .select("name")
          .lean();
        const relatedNames = relatedLocations.map((loc) => loc.name);
        query.$or.push({ locationName: { $in: relatedNames } });
      }

      const allRA = await RiskAssessment.find(query)
        .sort({ assessmentDate: -1, createdAt: -1 })
        .lean();

      result.riskAssessments = allRA.map((ra) => ({
        _id: ra._id,
        formCode: ra.formCode || "",
        serialNumber: ra.serialNumber || "",
        locationName: ra.locationName,
        assessmentDate: ra.assessmentDate,
        version: ra.version,
        filePath: ra.filePath,
        fileName: ra.fileName,
      }));

      // Keep backward-compat single field (latest)
      if (allRA.length > 0 && allRA[0]?.filePath) {
        result.riskAssessment = allRA[0].filePath;
        result.riskAssessmentId = String(allRA[0]._id);
        result.riskAssessmentFileName = allRA[0].fileName || "";
      }
    }

    // ── Near Miss Reports (ALL for operations at this location) ──
    // Include operations from all related locations (same city/region)
    if (locationId) {
      // Step 1 – Get all operation ref numbers for this location AND related locations
      const locationIdsToSearch = relatedLocationIds.length > 0 
        ? relatedLocationIds 
        : [locationId];
      
      const ops = await StsOperation.find({
        location: { $in: locationIdsToSearch },
        isLatest: true,
      })
        .select("Operation_Ref_No")
        .lean();

      const opRefs = ops
        .map((o) => o.Operation_Ref_No)
        .filter(Boolean);

      // Step 2 – Find all near miss reports whose JobRefNo matches any op ref
      if (opRefs.length > 0) {
        const nearMisses = await NearMiss.find({
          JobRefNo: { $in: opRefs },
        })
          .sort({ timeOfIncident: -1, createdAt: -1 })
          .lean();

        result.nearMissReports = nearMisses.map((nm) => ({
          _id: nm._id,
          formCode: nm.formCode || "",
          serialNumber: nm.serialNumber || "",
          JobRefNo: nm.JobRefNo,
          VesselName: nm.VesselName,
          timeOfIncident: nm.timeOfIncident,
          NameOfObserver: nm.NameOfObserver,
          PositionOfObserver: nm.PositionOfObserver,
          TypeOfReporting: nm.TypeOfReporting,
          AreaOfNearMiss: nm.AreaOfNearMiss,
          Description: nm.Description,
          ImmediateCause: nm.ImmediateCause,
          RootCause: nm.RootCause,
          CorrectiveAction: nm.CorrectiveAction,
          status: nm.status,
        }));
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Pre-STS docs fetch error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
