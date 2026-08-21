import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies Open-Meteo's free Geocoding API so a user can search for any
 * location by name (not just the ones already seeded in our Location master).
 * GET /api/operations/dashboard/weather/search?q=..
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ success: true, data: [] });
    }

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Geocoding provider error: ${text}` },
        { status: 502 }
      );
    }
    const json = await res.json();

    const data = (json.results || []).map((r) => ({
      name: r.name,
      country: r.country || "",
      admin1: r.admin1 || "",
      latitude: r.latitude,
      longitude: r.longitude,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Weather location search error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search locations" },
      { status: 500 }
    );
  }
}
