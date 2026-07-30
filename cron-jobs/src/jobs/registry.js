import * as hrCid from "./hrCidExpiryReminders.js";
import * as hrStatutory from "./hrStatutoryCertificateExpiryReminders.js";
import * as hrPoacPassport from "./hrPoacPassportExpiryReminders.js";
import * as stsDocs from "./operationsStsDocumentationFollowUp.js";
import * as pmsTesting from "./pmsEquipmentTestingReminders.js";
import * as pmsWarehouse from "./pmsWarehouseEstimatedEndOverdue.js";
import * as spSyncHr from "./sharepointSyncHr.js";
import * as spSyncPms from "./sharepointSyncPms.js";
import * as spSyncQhse from "./sharepointSyncQhse.js";
import * as spSyncOperations from "./sharepointSyncOperations.js";

/**
 * All Oceane-Marine GET /api/cron/* jobs (one entry each).
 *
 * Email jobs: Oceane handlers use **UTC calendar days** (startOfUtcDay / diffUtcCalendarDays).
 * They do **not** send at a wall-clock “email time”; they send when **that UTC date** matches
 * rules (e.g. exactly 5 / 15 / 30 days before expiry). So each must run **≥ once per UTC day**.
 * The 06:00–06:20 stagger is only to spread load; use CRON_TZ=UTC (default) so “daily” aligns with app logic.
 *
 * SharePoint auto-sync: one per module, staggered 01:00–04:00 (Operations last, it's the
 * largest). Each only QUEUES a background job; the app worker runs the heavy sync. Re-walks
 * the tree so new files/folders are picked up; already-synced files are skipped.
 */
export const allJobs = [
  hrCid,
  hrStatutory,
  hrPoacPassport,
  stsDocs,
  pmsTesting,
  pmsWarehouse,
  spSyncHr,
  spSyncPms,
  spSyncQhse,
  spSyncOperations,
];
