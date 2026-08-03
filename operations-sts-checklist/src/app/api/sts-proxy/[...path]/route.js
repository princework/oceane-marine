/**
 * Proxy for STS checklist API. Forwards requests to the main app (Oceane-Marine)
 * to avoid CORS when frontend and backend run on different origins/ports.
 *
 * Server-side target (in order):
 *   STS_API_BASE_URL — server-only; use when NEXT_PUBLIC_* is wrong at runtime (e.g. Docker).
 *   NEXT_PUBLIC_API_BASE_URL1 — shared with client (signature URL helpers, etc.).
 *
 * POST/PUT bodies are buffered and re-sent so the upstream reliably receives the full body
 * (streaming request.body to fetch() is unreliable in some Next/Node setups).
 */
function getBackendBase() {
  const raw =
    process.env.STS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL1 ||
    'http://localhost:3000/api/operations/sts-checklist';
  return raw.replace(/\/$/, '');
}

/** Forward headers the backend may need for auth/session. */
function buildUpstreamHeaders(request, contentType) {
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  const auth = request.headers.get('authorization');
  if (auth) {
    headers['Authorization'] = auth;
  }
  const cookie = request.headers.get('cookie');
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  return headers;
}

async function handleRequest(request, context, method) {
  const params = await Promise.resolve(context.params || {});
  const pathSegment = Array.isArray(params.path) ? params.path.join('/') : '';

  const requestUrl = new URL(request.url);
  const queryString = requestUrl.search;

  const BACKEND = getBackendBase();
  const url = pathSegment
    ? `${BACKEND}/${pathSegment}${queryString}`
    : `${BACKEND}${queryString}`;

  const contentType = request.headers.get('content-type') || '';

  const fetchOptions = {
    method,
    headers: buildUpstreamHeaders(request, contentType),
  };

  if (method === 'POST' || method === 'PUT') {
    const bodyBuffer = await request.arrayBuffer();
    if (bodyBuffer.byteLength > 0) {
      fetchOptions.body = bodyBuffer;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[sts-proxy] →', method, url);
  }

  try {
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: res.statusText || 'Invalid response from server' };
    }
    return Response.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('[sts-proxy]', err);
    return Response.json(
      {
        error:
          err.message ||
          'Cannot reach the main app. Is Oceane-Marine running at ' +
            BACKEND +
            '?',
      },
      { status: 502 }
    );
  }
}

export async function GET(request, context) {
  return handleRequest(request, context, 'GET');
}

export async function POST(request, context) {
  return handleRequest(request, context, 'POST');
}

export async function PUT(request, context) {
  return handleRequest(request, context, 'PUT');
}
