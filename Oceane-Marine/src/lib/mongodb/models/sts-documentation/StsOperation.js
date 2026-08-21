import mongoose from "mongoose";

/* ======================================================
   EQUIPMENT USAGE SUB SCHEMA
====================================================== */

const equipmentUsageSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true,
    },

    /**
     * Which PMS collection `equipment` points at.
     *
     * The `ref` above is declared as "Equipment", so `.populate()` resolves
     * primary equipment only and returns null for an accessory. Readers must
     * branch on this field — see `hydrateEquipmentUsage`. Defaults to
     * "Equipment" so operations saved before accessories were selectable keep
     * populating exactly as they did.
     */
    equipmentSource: {
      type: String,
      enum: ["Equipment", "Accessories"],
      default: "Equipment",
    },

    /**
     * Name captured at selection time. Lets the view page label an accessory
     * without a second lookup, and keeps a completed operation readable if the
     * PMS record is later renamed or deleted.
     */
    equipmentName: {
      type: String,
      trim: true,
      default: "",
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: Date,

    usedHours: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["IN_USE", "RELEASED"],
      default: "IN_USE",
    },
  },
  { _id: false }
);


/* ======================================================
   DOCUMENT STORAGE SUB SCHEMA
====================================================== */

const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      required: true,
      trim: true
    },

    filePath: {
      type: String,
      required: true,
      trim: true
    },

    checklistId: {
      type: mongoose.Schema.Types.ObjectId
    },

    source: {
      type: String,
      enum: [
        "SYSTEM_GENERATED",   // PDF from Agenda
        "MANUAL_UPLOAD",      // Admin Upload
        "AUTO_LOCATION",      // Auto from Location Master
        "CHECKLIST_HARDCOPY", // Paper form scanned / uploaded from STS Checklist dashboard
        "EMAIL_IMPORT",       // Attachment pulled from a client nomination email
      ],
      default: "SYSTEM_GENERATED"
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    uploadedAt: {
      type: Date,
      default: Date.now
    },

    status: {
      type: String,
      enum: ["PENDING", "GENERATING", "GENERATED", "FAILED"],
      default: "GENERATED"
    }
  },
  { _id: false }
);


/* ======================================================
   MAIN STS OPERATION SCHEMA
====================================================== */

const stsOperationSchema = new mongoose.Schema(
  {
    /* ================= VERSION CONTROL ================= */

    parentOperationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    version: {
      type: Number,
      default: 1
    },

    isLatest: {
      type: Boolean,
      default: true
    },


    /* ================= CORE OPERATION ================= */

    Operation_Ref_No: {
      type: String,
      required: true,
      trim: true,
      // index defined below via schema.index()
    },

    typeOfOperation: String,

    mooringMaster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MooringMaster"
    },

    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location"
    },

    client: String,

    agent: String,

    /* ================= OPERATION STATUS ================= */

    operationStatus: {
      type: String,
      enum: ["DRAFT", "INPROGRESS", "COMPLETED", "CANCELED", "Lined Up"],
      default: "Lined Up"
    },

    isSubmitted: {
      type: Boolean,
      default: false,
      index: true
    },

    submittedAt: {
      type: Date
    },


    /* ================= TIMINGS ================= */

    operationStartTime: {
      type: Date,
      required: true,
      index: true
    },

    operationEndTime: Date,


    /* ================= OPERATION CONFIG ================= */

    flowDirection: {
      type: String,
      enum: ["left", "right", "both"],
      default: "left"
    },

    operationType: {
      type: String,
      enum: ["underway", "At Anchor"]
    },


    /* ================= VESSEL INFO ================= */

    loaCHS: {
      type: String
    },

    loaMS: {
      type: String
    },

    vesselTypeCHS: {
      type: String,
      enum: [
        "VLCC",
        "ULCC",
        "Suexmax",
        "Aframax",
        "panamax",
        "post-panamax",
        "Handysize",
        "Capezie",
        "Supramax"
      ]
    },

    vesselTypeMS: {
      type: String,
      enum: [
        "VLCC",
        "ULCC",
        "Suexmax",
        "Aframax",
        "panamax",
        "post-panamax",
        "Handysize",
        "Capezie",
        "Supramax"
      ]
    },


    /* ================= CARGO ================= */

    quantity: Number,

    typeOfCargo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CargoType"
    },


    /* ================= EQUIPMENT USAGE ================= */

    equipments: {
      type: [equipmentUsageSchema],
      default: []
    },


    /* ================= DOCUMENT STORAGE  ================= */

    documents: {
      type: [documentSchema],
      default: []
    },


    /* ================= CHS VESSEL DOCUMENTS ================= */

    chsSSQ: String,                // Ship Standard Questionnaire
    chsQ88: String,                // Q88 vessel data
    chsMooringArrangement: String, // Mooring Arrangement
    chsGAPlan: String,             // General Arrangement Plan
    chsMSDS: String,               // Material Safety Data Sheet
    chsIndemnity: String,          // Indemnity document


    /* ================= MS VESSEL DOCUMENTS ================= */

    msSSQ: String,                 // Ship Standard Questionnaire
    msQ88: String,                 // Q88 vessel data
    msMooringArrangement: String,  // Mooring Arrangement
    msGAPlan: String,              // General Arrangement Plan
    msMSDS: String,                // Material Safety Data Sheet
    msIndemnity: String,           // Indemnity document


    /* ================= PRE-STS & OTHER DOCUMENTS ================= */

    jpo: String,
    riskAssessment: String,
    mooringPlan: String,
    DeclarationAtSea: String,
    checklist1: String,
    checklist2: String,
    checklist3AB: String,
    checklist4AF: String,
    checklist5AC: String,
    checklist6AB: String,
    checklist7: String,
    stsTimesheet: String,
    standingOrder: String,
    stsEquipChecklistPriorOps: String,
    stsEquipChecklistAfterOps: String,
    chsFeedback: String,
    msFeedback: String,
    hourlyChecks: String,
    restHoursCKL: String,
    incidentReporting: String,


    /* ================= ADDITIONAL INFO ================= */

    chs: String,
    ms: String,
    remarks: String,

    /** Free-text catch-all for anything an email nomination states that has no
     *  dedicated field (vessel flag, cargo grade, capacities, special requests, etc).
     *  Populated by "Import from Email"; also editable by hand. */
    description: String,


    /* ================= AUDIT ================= */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    /* ================= STS DOCUMENTATION FOLLOW-UP EMAILS (cron dedupe) ================= */

    /** Sent when operation stayed INPROGRESS ≥ 7 days (UTC calendar-day rule) */
    stsDocFollowUpInProgress7dSentAt: Date,

    /** Sent when operation stayed INPROGRESS ≥ 30 days */
    stsDocFollowUpInProgress30dSentAt: Date,

    /** Sent once when COMPLETED ≥ 7 days and required documents were still missing */
    stsDocFollowUpCompletedMissingSentAt: Date,

    /* ================= TRANSFER LOCATION QUESTIONNAIRE (client email dedupe) ================= */

    /** Set when the QHSE team emails the client the Transfer Location Questionnaire link. */
    transferLocationQuestSentAt: Date,

    /** Recipient the link was last sent to. */
    transferLocationQuestSentTo: String,

    /* ================= EMAIL IMPORT PROVENANCE ================= */

    /**
     * Present only on operations created by "Import from Email".
     * Absent on hand-created records, so `Boolean(op.emailImport)` distinguishes the two.
     */
    emailImport: {
      /** Gmail message id — lets a re-import of the same email be detected. */
      messageId: { type: String, trim: true, index: true },

      /** Sender as it appeared on the email, e.g. "Chartering Desk <ops@client.com>". */
      from: { type: String, trim: true },

      subject: { type: String, trim: true },

      importedAt: Date,

      importedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },

      /** How the fields were read: with a model (Claude or OpenAI), or by deterministic matching. */
      extraction: {
        type: String,
        enum: ["model", "model-openai", "deterministic", "deterministic-fallback"]
      }
    }

  },
  {
    timestamps: true
  }
);


/* ======================================================
   INDEXES (PERFORMANCE)
====================================================== */

stsOperationSchema.index({ Operation_Ref_No: 1 }); // Non-unique: multiple versions share same ref
stsOperationSchema.index({ operationStartTime: -1 });
stsOperationSchema.index({ operationStatus: 1 });
stsOperationSchema.index({ "equipments.equipment": 1 });
stsOperationSchema.index({ location: 1 });


/* ======================================================
   EXPORT MODEL
====================================================== */

/** Drop the cached model so schema changes (e.g. equipmentSource) apply — without
 *  this, a long-running dev server keeps the old schema and silently strips the
 *  new equipment-usage fields in strict mode. */
if (mongoose.models.StsOperation) {
  mongoose.deleteModel("StsOperation");
}

export default mongoose.model("StsOperation", stsOperationSchema);
