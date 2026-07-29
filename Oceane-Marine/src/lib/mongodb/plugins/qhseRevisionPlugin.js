/**
 * QHSE Revision Plugin — adds a per-record `revNo` that starts at "1.0" on
 * creation and is bumped by 0.1 on each edit (1.0 → 1.1 → 1.2 → …).
 *
 * Convention (applies to all QHSE form records EXCEPT Training Plan, Drill
 * Plan and Drill Report):
 *  - A brand new record is saved with `revNo = "1.0"`.
 *  - When an existing record is edited, the API should call
 *    `record.bumpRevision()` (or `bumpRevNo(current)` from the helper) before
 *    saving so the rev advances by one minor (1.0 → 1.1 → 1.2 → …, capped at
 *    1.9 → 2.0 → 2.1 → …).
 *
 * Fields added:
 *  - revNo (String, default "1.0")
 *
 * Usage:
 *   import qhseRevisionPlugin from "@/lib/mongodb/plugins/qhseRevisionPlugin";
 *   schema.plugin(qhseRevisionPlugin);
 */

// Re-export the existing canonical helper so callers have a single import
// path when they're working with revisions through this plugin.
import {
  getNextRevisionNumber,
  DEFAULT_REVISION,
} from "../../utils/qhse-revision.js";

export { getNextRevisionNumber, DEFAULT_REVISION };

/**
 * Alias for `getNextRevisionNumber` — kept for legibility at call sites that
 * read "bump the revNo".
 *
 *   bumpRevNo("1.0") => "1.1"
 *   bumpRevNo("1.9") => "1.10" (callers should treat the value as opaque)
 */
export function bumpRevNo(currentRevNo) {
  return getNextRevisionNumber(currentRevNo);
}

export default function qhseRevisionPlugin(schema) {
  // Skip adding the field if the model already declares its own `revNo`
  // (e.g. PoacCrossCompetency, DrillReport).
  if (!schema.path("revNo")) {
    schema.add({
      revNo: {
        type: String,
        default: DEFAULT_REVISION,
        trim: true,
      },
    });
  }

  // Always seed "1.0" on creation so legacy records that come through without
  // a value still get a proper baseline.
  schema.pre("save", function (next) {
    if (this.isNew && !this.revNo) {
      this.revNo = DEFAULT_REVISION;
    }
    if (typeof next === "function") next();
  });

  /**
   * Bump this document's revNo by one minor version. Does not save.
   *
   *   doc.bumpRevision();   // 1.0 -> 1.1
   *   await doc.save();
   */
  schema.methods.bumpRevision = function bumpRevision() {
    this.revNo = getNextRevisionNumber(this.revNo);
    return this;
  };
}
