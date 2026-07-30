import { auth as googleAuth, gmail as gmailApi } from "@googleapis/gmail";

/**
 * Gmail access for the shared operations mailbox.
 *
 * Server-only. Credentials, raw MIME and attachment bytes never leave this process —
 * callers receive parsed text and Buffers.
 */

const DEFAULT_SYNCED_LABEL = "STS/Synced";
const DEFAULT_USER_ID = "me";

/** Thrown when the mailbox needs reconnecting; carries an operator-facing message. */
export class GmailAuthError extends Error {
  constructor(message = "Gmail access expired. Reconnect the operations mailbox in Settings.") {
    super(message);
    this.name = "GmailAuthError";
    this.statusCode = 502;
  }
}

/** Thrown when the integration has not been configured yet. */
export class GmailConfigError extends Error {
  constructor(missing) {
    super(
      `Gmail is not configured. Missing ${missing.join(", ")}. See SETUP.md to connect the operations mailbox.`
    );
    this.name = "GmailConfigError";
    this.statusCode = 503;
  }
}

export function syncedLabelName() {
  return process.env.GMAIL_SYNCED_LABEL || DEFAULT_SYNCED_LABEL;
}

function userId() {
  return process.env.GMAIL_USER_ID || DEFAULT_USER_ID;
}

/**
 * Build an authorised Gmail client from the stored refresh token.
 * @throws {GmailConfigError} when env vars are absent
 */
export function getGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  const missing = [];
  if (!clientId) missing.push("GMAIL_CLIENT_ID");
  if (!clientSecret) missing.push("GMAIL_CLIENT_SECRET");
  if (!refreshToken) missing.push("GMAIL_REFRESH_TOKEN");
  if (missing.length) throw new GmailConfigError(missing);

  const oauthClient = new googleAuth.OAuth2(clientId, clientSecret);
  oauthClient.setCredentials({ refresh_token: refreshToken });

  return gmailApi({ version: "v1", auth: oauthClient });
}

/**
 * Translate a googleapis failure into something an operator can act on.
 * Anything unrecognised is re-thrown untouched so the route can log it and show a generic message.
 */
function rethrowGmailError(error) {
  const status = error?.response?.status ?? error?.code;
  const reason = error?.response?.data?.error;

  if (status === 401 || reason === "invalid_grant" || reason === "unauthorized_client") {
    throw new GmailAuthError();
  }
  if (status === 403) {
    throw new GmailAuthError(
      "The operations mailbox denied access. Check that the Gmail API is enabled and the account has granted permission."
    );
  }
  throw error;
}

/* =====================
   SEARCH
====================== */

/** Escape a value being embedded in a Gmail search operator. */
function quoteSearchValue(value) {
  return `"${String(value).replace(/"/g, "")}"`;
}

/**
 * Compose the mailbox query. Always scoped — never searches the whole inbox.
 * @param {{ from?: string, excludeSynced?: boolean }} options
 */
export function buildSearchQuery({ from, excludeSynced = false } = {}) {
  const parts = ["has:attachment", "newer_than:30d"];

  if (excludeSynced) parts.push(`-label:${quoteSearchValue(syncedLabelName())}`);

  const scopeLabel = process.env.GMAIL_SEARCH_LABEL;
  if (scopeLabel && scopeLabel.trim()) parts.push(`label:${quoteSearchValue(scopeLabel.trim())}`);

  /* Keeps unrelated mail out of the picker. Comma-separated terms are OR-ed,
     e.g. GMAIL_SUBJECT_FILTER="STS,nomination" → subject:(STS OR nomination). */
  const subjectFilter = process.env.GMAIL_SUBJECT_FILTER;
  if (subjectFilter && subjectFilter.trim()) {
    const terms = subjectFilter
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean)
      .map(quoteSearchValue);
    if (terms.length) parts.push(`subject:(${terms.join(" OR ")})`);
  }

  const sender = typeof from === "string" ? from.trim() : "";
  if (sender) parts.push(`from:${quoteSearchValue(sender)}`);

  return parts.join(" ");
}

/**
 * List candidate messages, newest first, with just enough metadata to render a picker.
 * @returns {Promise<Array<{id: string, from: string, subject: string, date: string|null, attachmentCount: number, synced: boolean}>>}
 */
export async function listCandidateMessages({ from, limit = 25 } = {}) {
  const gmail = getGmailClient();
  const query = buildSearchQuery({ from });

  try {
    const listRes = await gmail.users.messages.list({
      userId: userId(),
      q: query,
      maxResults: Math.min(Math.max(Number(limit) || 25, 1), 50),
    });

    const ids = (listRes.data.messages || []).map((m) => m.id);
    if (!ids.length) return [];

    const syncedLabelId = await findLabelId(gmail, syncedLabelName());

    /* "full" rather than "metadata": the metadata format omits payload.parts, so the
       MIME tree would be empty and every message would report zero attachments.
       Attachment bodies are not inlined by "full" — only their ids and sizes — so the
       extra weight is just the text parts. */
    const details = await Promise.all(
      ids.map((id) =>
        gmail.users.messages.get({
          userId: userId(),
          id,
          format: "full",
        })
      )
    );

    return details.map((res) => {
      const msg = res.data;
      const headers = headerMap(msg.payload?.headers);
      return {
        id: msg.id,
        from: headers.from || "(unknown sender)",
        subject: headers.subject || "(no subject)",
        date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
        attachmentCount: countAttachments(msg.payload),
        synced: Boolean(syncedLabelId && (msg.labelIds || []).includes(syncedLabelId)),
      };
    });
  } catch (error) {
    return rethrowGmailError(error);
  }
}

/* =====================
   MESSAGE PARSING
====================== */

function headerMap(headers) {
  const out = {};
  for (const h of headers || []) {
    if (h?.name) out[h.name.toLowerCase()] = h.value || "";
  }
  return out;
}

function decodeBody(data) {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Attachment parts are those carrying a filename and an attachment id. */
function isAttachmentPart(part) {
  return Boolean(part?.filename && part.filename.trim() && part.body?.attachmentId);
}

function countAttachments(payload) {
  let count = 0;
  walkParts(payload, (part) => {
    if (isAttachmentPart(part)) count += 1;
  });
  return count;
}

/** Depth-first walk over the MIME tree. */
function walkParts(part, visit) {
  if (!part) return;
  visit(part);
  for (const child of part.parts || []) walkParts(child, visit);
}

/** Minimal HTML → text for messages with no text/plain alternative. */
export function htmlToText(html) {
  if (!html) return "";
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Drop quoted replies and signatures so the extractor only sees the new message.
 * Conservative: if a marker appears in the first few lines the text is kept whole,
 * since that usually means the whole body is a forward we still need to read.
 */
export function stripQuotedReply(text) {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/);

  const markers = [
    /^\s*On .+ wrote:\s*$/i,
    /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i,
    /^\s*_{10,}\s*$/,
    /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
    /^\s*From:\s*.+<.+@.+>\s*$/i,
    /^\s*Sent from my \w+/i,
  ];

  for (let i = 0; i < lines.length; i += 1) {
    if (markers.some((re) => re.test(lines[i]))) {
      // A marker in the opening lines means the body *is* the quoted material — keep it.
      if (i < 3) break;
      return lines.slice(0, i).join("\n").trim();
    }
  }
  return String(text).trim();
}

/**
 * Fetch one message and reduce it to readable text plus attachment descriptors.
 * @returns {Promise<{id, from, subject, date, bodyText, attachments: Array<{filename, mimeType, attachmentId, size}>}>}
 */
export async function getMessageDetail(messageId) {
  const gmail = getGmailClient();

  let msg;
  try {
    const res = await gmail.users.messages.get({
      userId: userId(),
      id: messageId,
      format: "full",
    });
    msg = res.data;
  } catch (error) {
    return rethrowGmailError(error);
  }

  const headers = headerMap(msg.payload?.headers);
  const plain = [];
  const html = [];
  const attachments = [];

  walkParts(msg.payload, (part) => {
    if (isAttachmentPart(part)) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        attachmentId: part.body.attachmentId,
        size: part.body.size || 0,
      });
      return;
    }
    if (part.mimeType === "text/plain" && part.body?.data) plain.push(decodeBody(part.body.data));
    else if (part.mimeType === "text/html" && part.body?.data) html.push(decodeBody(part.body.data));
  });

  const raw = plain.length ? plain.join("\n") : htmlToText(html.join("\n"));

  return {
    id: msg.id,
    from: headers.from || "",
    subject: headers.subject || "",
    date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
    bodyText: stripQuotedReply(raw),
    attachments,
  };
}

/** Download one attachment as a Buffer. */
export async function downloadAttachment(messageId, attachmentId) {
  const gmail = getGmailClient();
  try {
    const res = await gmail.users.messages.attachments.get({
      userId: userId(),
      messageId,
      id: attachmentId,
    });
    return Buffer.from(res.data.data || "", "base64url");
  } catch (error) {
    return rethrowGmailError(error);
  }
}

/* =====================
   LABELLING
====================== */

async function findLabelId(gmail, name) {
  try {
    const res = await gmail.users.labels.list({ userId: userId() });
    const match = (res.data.labels || []).find((l) => l.name === name);
    return match ? match.id : null;
  } catch {
    // A missing label list should never block reading mail.
    return null;
  }
}

async function ensureLabelId(gmail, name) {
  const existing = await findLabelId(gmail, name);
  if (existing) return existing;

  const created = await gmail.users.labels.create({
    userId: userId(),
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  return created.data.id;
}

/**
 * Apply the synced label so the message can be shown as already imported.
 * Never throws — a labelling failure must not undo a successful import.
 * @returns {Promise<boolean>} whether the label was applied
 */
export async function markSynced(messageId) {
  try {
    const gmail = getGmailClient();
    const labelId = await ensureLabelId(gmail, syncedLabelName());
    if (!labelId) return false;

    await gmail.users.messages.modify({
      userId: userId(),
      id: messageId,
      requestBody: { addLabelIds: [labelId] },
    });
    return true;
  } catch (error) {
    console.error("Failed to apply STS synced label:", error?.message || error);
    return false;
  }
}
