import { connectDB } from "../../config/connection.js";
import PoacMatrix from "../../mongodb/models/hr/PoacMatrix.js";
import {
  startOfUtcDay,
  addUtcDays,
  isSameUtcDate,
} from "../../utils/utcDate.js";
import {
  buildPoacPassportExpiryReminderEmail,
  buildPoacPassportExpiredNoticeEmail,
} from "./templates/HR/poacPassportExpiryReminder.js";
import {
  buildPoacMastersCocExpiryReminderEmail,
  buildPoacMastersCocExpiredNoticeEmail,
} from "./templates/HR/poacMastersCocExpiryReminder.js";
import {
  buildPoacMedicalsExpiryReminderEmail,
  buildPoacMedicalsExpiredNoticeEmail,
} from "./templates/HR/poacMedicalsExpiryReminder.js";
import { sendResendEmail } from "./sendResendEmail.js";

function formatExpiryDate(validity) {
  try {
    return new Date(validity).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return String(validity);
  }
}

/**
 * Parse POAC date string (typically YYYY-MM-DD from date input) to a Date.
 * @returns {Date|null}
 */
function parsePoacExpiryDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    const dt = new Date(Date.UTC(y, m, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m &&
      dt.getUTCDate() === d
    ) {
      return dt;
    }
    return null;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function parseRecipientList() {
  const raw =
    process.env.HR_POAC_PASSPORT_EXPIRY_REMINDER_TO ||
    process.env.HR_CID_EXPIRY_REMINDER_TO ||
    process.env.HR_TEAM_EMAIL ||
    "";
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function alreadySentForExpiry(priorExpiryRaw, expiryDate) {
  if (!priorExpiryRaw) return false;
  const prior = parsePoacExpiryDate(priorExpiryRaw);
  return Boolean(prior && isSameUtcDate(prior, expiryDate));
}

function emptyMilestoneBucket() {
  return { candidates: 0, sent: 0, skipped: 0 };
}

/**
 * Process 5d-before + 1d-after milestones for one credential on one row.
 */
async function processCredentialMilestones({
  matrixId,
  rowIndex,
  row,
  recipients,
  yesValue,
  expiryRaw,
  fiveDaysAhead,
  oneDayAgo,
  dedupe5dField,
  dedupeExpiredField,
  buildReminder,
  buildExpired,
  setPath5dAt,
  setPath5dExpiry,
  setPathExpiredAt,
  setPathExpiredExpiry,
  bucket,
  errorPrefix,
  errors,
}) {
  if (yesValue !== "Yes") return;

  const expiryDate = parsePoacExpiryDate(expiryRaw);
  if (!expiryDate) return;

  const expiryKey = String(expiryRaw).trim();
  const emailParams = {
    poacName: row.poacName,
    stsServiceProvider: row.stsServiceProvider,
    expiryDateFormatted: formatExpiryDate(expiryDate),
  };

  if (isSameUtcDate(expiryDate, fiveDaysAhead)) {
    bucket.days5.candidates += 1;
    try {
      if (alreadySentForExpiry(row[dedupe5dField], expiryDate)) {
        bucket.days5.skipped += 1;
      } else {
        const { subject, html, text } = buildReminder(emailParams);
        await sendResendEmail({ to: recipients, subject, html, text });
        await PoacMatrix.updateOne(
          { _id: matrixId },
          {
            $set: {
              [setPath5dAt]: new Date(),
              [setPath5dExpiry]: expiryKey,
            },
          }
        );
        bucket.days5.sent += 1;
      }
    } catch (e) {
      errors.push(`${errorPrefix}:5d: ${e.message || e}`);
    }
  }

  if (isSameUtcDate(expiryDate, oneDayAgo)) {
    bucket.expired1d.candidates += 1;
    try {
      if (alreadySentForExpiry(row[dedupeExpiredField], expiryDate)) {
        bucket.expired1d.skipped += 1;
      } else {
        const { subject, html, text } = buildExpired(emailParams);
        await sendResendEmail({ to: recipients, subject, html, text });
        await PoacMatrix.updateOne(
          { _id: matrixId },
          {
            $set: {
              [setPathExpiredAt]: new Date(),
              [setPathExpiredExpiry]: expiryKey,
            },
          }
        );
        bucket.expired1d.sent += 1;
      }
    } catch (e) {
      errors.push(`${errorPrefix}:expired1d: ${e.message || e}`);
    }
  }
}

/**
 * ACTIVE POAC matrix rows:
 * - Valid Passport = Yes → 5d before / 1d after passport expiry emails
 * - Valid Master's COC = Yes → 5d before / 1d after Master's COC expiry emails
 * - Valid Medicals = Yes → 5d before / 1d after medicals expiry emails
 *
 * @returns {Promise<{
 *   passport: { days5: object; expired1d: object };
 *   mastersCoc: { days5: object; expired1d: object };
 *   medicals: { days5: object; expired1d: object };
 *   errors: string[];
 * }>}
 */
export async function runPoacPassportExpiryReminderJob() {
  await connectDB();

  const recipients = parseRecipientList();
  const result = {
    passport: {
      days5: emptyMilestoneBucket(),
      expired1d: emptyMilestoneBucket(),
    },
    mastersCoc: {
      days5: emptyMilestoneBucket(),
      expired1d: emptyMilestoneBucket(),
    },
    medicals: {
      days5: emptyMilestoneBucket(),
      expired1d: emptyMilestoneBucket(),
    },
    errors: [],
  };

  if (recipients.length === 0) {
    result.errors.push(
      "No recipients: set HR_POAC_PASSPORT_EXPIRY_REMINDER_TO (comma-separated), or HR_CID_EXPIRY_REMINDER_TO / HR_TEAM_EMAIL"
    );
    return result;
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    result.errors.push(
      "Resend not configured: RESEND_API_KEY and RESEND_FROM_EMAIL required"
    );
    return result;
  }

  const todayStart = startOfUtcDay(new Date());
  const fiveDaysAhead = addUtcDays(todayStart, 5);
  const oneDayAgo = addUtcDays(todayStart, -1);

  const matrices = await PoacMatrix.find({ status: "ACTIVE" }).lean();

  for (const matrix of matrices) {
    const rows = Array.isArray(matrix.rows) ? matrix.rows : [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      if (!row) continue;

      const errorPrefix = `${matrix._id}:row${rowIndex}`;

      await processCredentialMilestones({
        matrixId: matrix._id,
        rowIndex,
        row,
        recipients,
        yesValue: row.validPassport,
        expiryRaw: row.validPassportExpiry,
        fiveDaysAhead,
        oneDayAgo,
        dedupe5dField: "lastPassportExpiryReminder5dExpiry",
        dedupeExpiredField: "lastPassportExpiredNotice1dExpiry",
        buildReminder: buildPoacPassportExpiryReminderEmail,
        buildExpired: buildPoacPassportExpiredNoticeEmail,
        setPath5dAt: `rows.${rowIndex}.lastPassportExpiryReminder5dAt`,
        setPath5dExpiry: `rows.${rowIndex}.lastPassportExpiryReminder5dExpiry`,
        setPathExpiredAt: `rows.${rowIndex}.lastPassportExpiredNotice1dAt`,
        setPathExpiredExpiry: `rows.${rowIndex}.lastPassportExpiredNotice1dExpiry`,
        bucket: result.passport,
        errorPrefix: `${errorPrefix}:passport`,
        errors: result.errors,
      });

      await processCredentialMilestones({
        matrixId: matrix._id,
        rowIndex,
        row,
        recipients,
        yesValue: row.validMastersCOC,
        expiryRaw: row.validMastersCOCExpiry,
        fiveDaysAhead,
        oneDayAgo,
        dedupe5dField: "lastMastersCocExpiryReminder5dExpiry",
        dedupeExpiredField: "lastMastersCocExpiredNotice1dExpiry",
        buildReminder: buildPoacMastersCocExpiryReminderEmail,
        buildExpired: buildPoacMastersCocExpiredNoticeEmail,
        setPath5dAt: `rows.${rowIndex}.lastMastersCocExpiryReminder5dAt`,
        setPath5dExpiry: `rows.${rowIndex}.lastMastersCocExpiryReminder5dExpiry`,
        setPathExpiredAt: `rows.${rowIndex}.lastMastersCocExpiredNotice1dAt`,
        setPathExpiredExpiry: `rows.${rowIndex}.lastMastersCocExpiredNotice1dExpiry`,
        bucket: result.mastersCoc,
        errorPrefix: `${errorPrefix}:mastersCoc`,
        errors: result.errors,
      });

      await processCredentialMilestones({
        matrixId: matrix._id,
        rowIndex,
        row,
        recipients,
        yesValue: row.validMedicals,
        expiryRaw: row.validMedicalsExpiry,
        fiveDaysAhead,
        oneDayAgo,
        dedupe5dField: "lastMedicalsExpiryReminder5dExpiry",
        dedupeExpiredField: "lastMedicalsExpiredNotice1dExpiry",
        buildReminder: buildPoacMedicalsExpiryReminderEmail,
        buildExpired: buildPoacMedicalsExpiredNoticeEmail,
        setPath5dAt: `rows.${rowIndex}.lastMedicalsExpiryReminder5dAt`,
        setPath5dExpiry: `rows.${rowIndex}.lastMedicalsExpiryReminder5dExpiry`,
        setPathExpiredAt: `rows.${rowIndex}.lastMedicalsExpiredNotice1dAt`,
        setPathExpiredExpiry: `rows.${rowIndex}.lastMedicalsExpiredNotice1dExpiry`,
        bucket: result.medicals,
        errorPrefix: `${errorPrefix}:medicals`,
        errors: result.errors,
      });
    }
  }

  return result;
}
