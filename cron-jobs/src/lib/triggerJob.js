/**
 * GET Oceane-Marine cron route with the same auth as production Next handlers.
 *
 * @param {{ baseUrl: string; cronSecret: string; path: string; jobId: string }} p
 * @returns {Promise<{ ok: boolean; status: number; body: unknown; error?: string }>}
 */
export async function triggerJob({ baseUrl, cronSecret, path: apiPath, jobId }) {
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        Accept: "application/json",
      },
    });

    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    const ms = Date.now() - started;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        body,
        error: `HTTP ${res.status} (${ms}ms)`,
      };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    const ms = Date.now() - started;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      body: null,
      error: `${msg} (${ms}ms)`,
    };
  }
}
