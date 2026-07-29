/**
 * Agenda 5.x does not support `backoff` / automatic retry on `agenda.define()`.
 * STS DOCX jobs all use names like `generate-ops-ofd-001`, `generate-declaration-of-sea`, etc.
 * This module reschedules failed DOCX jobs with exponential backoff until success or max attempts.
 *
 * Env (optional):
 *   DOCX_JOB_MAX_ATTEMPTS — max total runs per job document (default 6: 1 initial + 5 retries)
 *   DOCX_JOB_RETRY_BASE_MS — first retry delay (default 5000)
 *   DOCX_JOB_RETRY_MAX_DELAY_MS — cap on delay (default 300000 = 5 min)
 */

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isDocxGenerationJobName(name) {
  return typeof name === "string" && name.startsWith("generate-");
}

/**
 * @param {import("agenda").Agenda} agenda
 */
export function attachDocxJobRetryHandler(agenda) {
  const maxAttempts = parsePositiveInt(process.env.DOCX_JOB_MAX_ATTEMPTS, 6);
  const baseMs = parsePositiveInt(process.env.DOCX_JOB_RETRY_BASE_MS, 5000);
  const maxDelayMs = parsePositiveInt(process.env.DOCX_JOB_RETRY_MAX_DELAY_MS, 300000);

  agenda.on("fail", async (err, job) => {
    try {
      const name = job?.attrs?.name;
      if (!isDocxGenerationJobName(name)) {
        return;
      }

      const failCount = job.attrs.failCount || 0;
      if (failCount >= maxAttempts) {
        console.error(
          `❌ DOCX job retry exhausted: ${name} (id=${job.attrs._id}, failCount=${failCount}, maxAttempts=${maxAttempts})`,
          err?.message || err
        );
        return;
      }

      const attemptIndex = Math.max(0, failCount - 1);
      const exp = Math.min(baseMs * 2 ** attemptIndex, maxDelayMs);
      const jitter = Math.floor(exp * 0.1 * Math.random());
      const delayMs = exp + jitter;
      const nextRunAt = new Date(Date.now() + delayMs);

      const collection = agenda._collection;
      if (!collection) {
        console.error("DOCX retry: agenda._collection missing");
        return;
      }

      const result = await collection.updateOne(
        { _id: job.attrs._id },
        {
          $set: {
            nextRunAt,
            lockedAt: null,
          },
        }
      );

      if (result.matchedCount === 0) {
        console.warn(`DOCX retry: no document updated for job ${name} id=${job.attrs._id}`);
        return;
      }

      console.log(
        `🔁 DOCX job scheduled for retry: ${name} (attempt ${failCount}/${maxAttempts}) → nextRunAt=${nextRunAt.toISOString()} (+${Math.round(delayMs)}ms)`,
        err?.message ? `— ${err.message}` : ""
      );
    } catch (e) {
      console.error("DOCX retry handler error:", e?.message || e);
    }
  });
}
