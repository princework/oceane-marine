import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

/**
 * Proxy route for external OPS-OFD-005B form
 * Forwards requests to the actual API routes
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Forward to actual API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/operations/sts-checklist/ops-ofd-005b?operationRef=${encodeURIComponent(operationRef)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Proxy GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req) {
  try {
    // Forward to create route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/operations/sts-checklist/ops-ofd-005b/create`;

    // Forward the request body
    const formData = await req.formData();

    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Proxy POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(req) {
  try {
    const { searchParams } = new URL(req.url);
    const operationRef = searchParams.get("operationRef");

    if (!operationRef) {
      return NextResponse.json(
        { error: "operationRef is required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Forward to actual API route
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get("origin") || "http://localhost:3000";
    const apiUrl = `${baseUrl}/api/operations/sts-checklist/ops-ofd-005b?operationRef=${encodeURIComponent(operationRef)}`;

    // Forward the request body
    const formData = await req.formData();

    const response = await fetch(apiUrl, {
      method: "PUT",
      body: formData,
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: CORS_HEADERS,
    });
  } catch (error) {
    console.error("Proxy PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
