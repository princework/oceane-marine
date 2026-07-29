/**
 * Parse JSON from a fetch Response.
 * When the server returns HTML (login redirect, nginx 413/502, Next error page, etc.),
 * `response.json()` throws "Unexpected token '<'". This surfaces a clear, actionable message.
 *
 * @param {Response} response
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readJsonFromResponse(response) {
  const text = await response.text();
  const trimmed = text.trimStart();

  if (!trimmed) {
    throw new Error(
      `Empty response from server (HTTP ${response.status}). The API may be unreachable or returned no body.`
    );
  }

  if (trimmed.startsWith("<")) {
    const status = response.status;
    let hint =
      "The server returned a web page instead of JSON. Open DevTools → Network, select the failed request, and check the Response tab.";
    if (status === 401 || status === 403) {
      hint =
        "Your session may have expired — refresh the page and sign in again, then retry.";
    } else if (status === 413) {
      hint =
        "Request body too large for the server — try a smaller attachment or ask the administrator to raise the upload limit.";
    } else if (status >= 500 && status <= 504) {
      hint =
        "A server or gateway error occurred — try again in a moment. If it persists, check server logs.";
    } else if (status === 404) {
      hint =
        "The API route was not found — confirm the app is deployed with the latest build and base URL is correct.";
    }
    throw new Error(`API error (HTTP ${status}): ${hint}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Invalid JSON from server (HTTP ${response.status}). ${msg}`.trim()
    );
  }
}
