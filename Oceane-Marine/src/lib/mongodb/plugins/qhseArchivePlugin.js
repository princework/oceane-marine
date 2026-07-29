/**
 * QHSE Archive Plugin — adds archive (soft-hide) fields to any Mongoose schema.
 *
 * Fields added:
 *  - isArchived (Boolean, default false, indexed)
 *  - archivedAt (Date)
 *  - archivedBy (String — user id / email)
 *  - archiveReason (String, optional)
 *
 * Usage:
 *   import qhseArchivePlugin from "@/lib/mongodb/plugins/qhseArchivePlugin";
 *   schema.plugin(qhseArchivePlugin);
 *
 * Active records can then be queried with `{ isArchived: { $ne: true } }`.
 */
export default function qhseArchivePlugin(schema) {
  schema.add({
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: String,
      default: null,
      trim: true,
    },
    archiveReason: {
      type: String,
      default: null,
      trim: true,
    },
  });

  schema.methods.archive = function archive(userId, reason) {
    this.isArchived = true;
    this.archivedAt = new Date();
    this.archivedBy = userId || null;
    this.archiveReason = reason || null;
    return this.save();
  };

  schema.methods.unarchive = function unarchive() {
    this.isArchived = false;
    this.archivedAt = null;
    this.archivedBy = null;
    this.archiveReason = null;
    return this.save();
  };
}
