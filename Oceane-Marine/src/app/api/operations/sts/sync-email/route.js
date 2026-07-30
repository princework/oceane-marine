import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionUser } from "@/lib/auth/getSessionUser";
import { connectDB } from "@/lib/config/connection";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import Location from "@/lib/mongodb/models/Location";
import CargoType from "@/lib/mongodb/models/CargoType";
import MasterStsClient from "@/lib/mongodb/models/MasterStsClient";
import MasterStsAgent from "@/lib/mongodb/models/MasterStsAgent";
import Counter from "@/lib/mongodb/models/generateFormCode";
import { buildStsCreateDocument } from "@/lib/operations/stsCreatePayload";
import { formatStsOperationRef } from "@/lib/operations/formatStsOperationRef";
import { saveBufferAsFile, subfolderForField } from "@/lib/utils/sts-file-storage";
import {
  listCandidateMessages,
  getMessageDetail,
  downloadAttachment,
  markSynced,
  GmailAuthError,
  GmailConfigError,
} from "@/lib/gmail";
import { extractFields, sanitizeExtractedFields, routeAttachments } from "@/lib/email-extract";

// googleapis depends on Node built-ins and will not run on the Edge runtime.
export const runtime = "nodejs";

/** Values hardcoded in the form's "Type of operation" dropdown. */
const TYPE_OF_OPERATION_OPTIONS = ["Ship to Ship", "POAC", "Fender Hire", "Hose hire"];

/** Values hardcoded in the form's "Operation Type" dropdown; also validated on save. */
const OPERATION_TYPE_OPTIONS = ["underway", "At Anchor"];

const PERMISSION_MESSAGE = "You do not have permission to create STS operation records.";

/**
 * Match a name against a master list, creating the record when it is genuinely new.
 *
 * Matching is case- and whitespace-insensitive so "SHELL TRADING" and "Shell  Trading"
 * resolve to the existing "Shell Trading" rather than adding near-duplicates. The stored
 * spelling always wins, so the value lines up with the form's dropdown.
 *
 * @returns {Promise<{name: string|null, created: boolean}>}
 */
async function resolveOrCreateMasterName(Model, rawName) {
  const name = typeof rawName === "string" ? rawName.trim().replace(/\s+/g, " ") : "";
  if (!name) return { name: null, created: false };

  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await Model.findOne({ name: { $regex: `^${escaped}$`, $options: "i" } }).lean();
  if (existing) return { name: existing.name, created: false };

  try {
    const created = await Model.create({ name, source: "EMAIL_IMPORT" });
    return { name: created.name, created: true };
  } catch (error) {
    // Unique index tripped by a concurrent import — re-read and use the winner.
    if (error?.code === 11000) {
      const raced = await Model.findOne({ name: { $regex: `^${escaped}$`, $options: "i" } }).lean();
      if (raced) return { name: raced.name, created: false };
    }
    throw error;
  }
}

/** Same gate as the create route — the sync endpoint must not be a way around it. */
async function requireEditor() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.operationsRole !== "editor") {
    return {
      user: null,
      response: NextResponse.json({ error: PERMISSION_MESSAGE }, { status: 403 }),
    };
  }
  return { user: sessionUser, response: null };
}

/** Map internal failures to something the operator can act on; never leak a stack trace. */
function errorResponse(error, fallback) {
  if (error instanceof GmailAuthError || error instanceof GmailConfigError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  /* Surface why the record was rejected rather than a blanket failure — field names
     are safe to show and make a bad import diagnosable. */
  if (error?.name === "ValidationError" && error.errors) {
    const fields = Object.keys(error.errors).join(", ");
    return NextResponse.json(
      { error: `The imported operation was rejected as incomplete (${fields}). No operation was created.` },
      { status: 422 }
    );
  }

  // buildStsCreateDocument raises these with an operator-facing message already.
  if (error?.statusCode === 400 && error.message) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const status = error?.status ?? error?.statusCode;
  if (status === 401) {
    return NextResponse.json(
      { error: "The document reader rejected its credentials. Check ANTHROPIC_API_KEY in the server environment." },
      { status: 502 }
    );
  }
  if (status === 429) {
    return NextResponse.json(
      { error: "The document reader is busy right now. Wait a moment and try the import again." },
      { status: 503 }
    );
  }

  console.error("STS email sync failed:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/* =====================
   GET — list importable emails
====================== */

export async function GET(req) {
  const { response: denied } = await requireEditor();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || undefined;
    const limit = Number(searchParams.get("limit")) || 25;

    const messages = await listCandidateMessages({ from, limit });
    return NextResponse.json({ messages });
  } catch (error) {
    return errorResponse(error, "Could not read the operations mailbox. Try again shortly.");
  }
}

/* =====================
   POST — import one email into a draft operation
====================== */

export async function POST(req) {
  const { user, response: denied } = await requireEditor();
  if (denied) return denied;

  await connectDB();

  let messageId;
  try {
    const body = await req.json();
    messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
  } catch {
    messageId = "";
  }

  if (!messageId) {
    return NextResponse.json({ error: "No email was selected to import." }, { status: 400 });
  }

  try {
    const email = await getMessageDetail(messageId);
    if (!email) {
      return NextResponse.json({ error: "No new client emails found." }, { status: 404 });
    }

    /* Build the allowed value lists from live master data, so extraction is
       constrained to options that actually exist in the dropdowns. */
    const [locationDocs, cargoDocs] = await Promise.all([
      Location.find().lean(),
      CargoType.find().lean(),
    ]);

    const locationsByName = new Map(
      locationDocs.filter((l) => l?.name).map((l) => [l.name.trim(), String(l._id)])
    );
    const cargoByName = new Map(
      cargoDocs.filter((c) => c?.type).map((c) => [c.type.trim(), String(c._id)])
    );

    const options = {
      typeOfOperation: TYPE_OF_OPERATION_OPTIONS,
      operationTypes: OPERATION_TYPE_OPTIONS,
      locations: [...locationsByName.keys()],
      cargoTypes: [...cargoByName.keys()],
    };

    /* Uses Claude when ANTHROPIC_API_KEY is set, otherwise falls back to matching
       the email text against the real option values. Attachment routing and record
       creation work either way. */
    const { fields: extracted, method } = await extractFields({
      subject: email.subject,
      bodyText: email.bodyText,
      options,
    });

    // Authoritative re-validation: anything that is not a real option becomes null.
    const fields = sanitizeExtractedFields(extracted, options);

    /* Attachments are filed by filename only — never by the model. */
    const { documents, unrouted } = routeAttachments({
      attachments: email.attachments,
      chsName: fields.chs,
      msName: fields.ms,
    });

    /* Download and persist through the same storage the form uses. */
    const uploadedFiles = {};
    for (const [slot, attachment] of Object.entries(documents)) {
      const buffer = await downloadAttachment(messageId, attachment.attachmentId);
      uploadedFiles[slot] = await saveBufferAsFile(
        buffer,
        attachment.filename,
        subfolderForField(slot)
      );
    }

    const manualDocumentationEntries = [];
    for (const attachment of unrouted) {
      const buffer = await downloadAttachment(messageId, attachment.attachmentId);
      const filePath = await saveBufferAsFile(buffer, attachment.filename, "documentation-extra");
      manualDocumentationEntries.push({
        documentType: String(attachment.filename).replace(/[^\w.\- ]/g, "_").slice(0, 200),
        filePath,
        source: "EMAIL_IMPORT",
        uploadedBy: user._id,
      });
    }

    /* Reserve an operation reference (same counter the ⚡ button uses). */
    const year = new Date().getFullYear();
    const counter = await Counter.findOneAndUpdate(
      { key: "STS_OPERATION", year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const operationRef = formatStsOperationRef(year, counter.seq);

    /* Client and agent are free text on the operation, backed by master lists.
       An unrecognised name is added to the master data rather than dropped. */
    const [clientResult, agentResult] = await Promise.all([
      resolveOrCreateMasterName(MasterStsClient, fields.client),
      resolveOrCreateMasterName(MasterStsAgent, fields.agent),
    ]);

    const createdMasters = [
      ...(clientResult.created ? [{ type: "client", name: clientResult.name }] : []),
      ...(agentResult.created ? [{ type: "agent", name: agentResult.name }] : []),
    ];

    /* Every operation is the head of its own version chain; the update route walks
       parentOperationId to build later versions. Required by the schema. */
    const parentOperationId = new mongoose.Types.ObjectId();

    /* Draft only — never submitted. The operator reviews and submits from the edit page. */
    const doc = buildStsCreateDocument({
      parentOperationId,
      body: {
        Operation_Ref_No: operationRef,
        operationStatus: "INPROGRESS",
        typeOfOperation: fields.typeOfOperation || "",
        location: fields.location ? locationsByName.get(fields.location) : "",
        typeOfCargo: fields.typeOfCargo ? cargoByName.get(fields.typeOfCargo) : "",
        operationType: fields.operationType || "",
        chs: fields.chs || "",
        ms: fields.ms || "",
        loaCHS: fields.loaCHS || "",
        loaMS: fields.loaMS || "",
        client: clientResult.name || "",
        agent: agentResult.name || "",
        quantity: fields.quantity || "",
      },
      uploadedFiles,
      manualDocumentationEntries,
      operationStartTime: new Date(),
    });

    /* Provenance: marks the record as email-derived and ties it back to the message. */
    const created = await StsOperation.create({
      ...doc,
      emailImport: {
        messageId,
        from: email.from,
        subject: email.subject,
        importedAt: new Date(),
        importedBy: user._id,
        extraction: method,
      },
    });

    const labelled = await markSynced(messageId);

    return NextResponse.json({
      success: true,
      operationId: String(created._id),
      operationRef,
      labelled,
      summary: {
        from: email.from,
        subject: email.subject,
        extraction: method,
        filled: Object.entries(fields)
          .filter(([, value]) => value)
          .map(([key]) => key),
        routed: Object.keys(uploadedFiles),
        unrouted: manualDocumentationEntries.length,
        createdMasters,
      },
    });
  } catch (error) {
    return errorResponse(error, "Could not import this email. The operation was not created.");
  }
}
