import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies Open-Meteo (https://open-meteo.com) — a free, keyless weather API.
 * GET /api/operations/dashboard/weather?lat=..&lon=..
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat"));
    const lon = parseFloat(searchParams.get("lon"));

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json(
        { error: "lat and lon are required" },
        { status: 400 }
      );
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility"
    );
    url.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max"
    );
    url.searchParams.set("timezone", "auto");
    // Open-Meteo's free tier serves up to 16 days out — lets an operator check
    // the forecast for a future operation date, not just "right now."
    url.searchParams.set("forecast_days", "16");

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Weather provider error: ${text}` },
        { status: 502 }
      );
    }
    const data = await res.json();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Weather fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch weather" },
      { status: 500 }
    );
  }
}
