import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Turning a client nomination email into STS operation data.
 *
 * Two independent halves:
 *  - `extractFieldsFromEmail(OpenAI)` reads the prose with a model, constrained to real dropdown
 *    values. OpenAI is used when `OPENAI_API_KEY` is set; Claude is a secondary path for when
 *    only `ANTHROPIC_API_KEY` is set instead.
 *  - `routeAttachments` files PDFs by filename only. No model involvement — a Q88 filed
 *    under the wrong vessel is worse than one left unfiled.
 */

const EXTRACTION_MODEL = "claude-sonnet-4-6";
const OPENAI_EXTRACTION_MODEL = "gpt-4.1-mini";
const TOOL_NAME = "record_sts_nomination";

const SYSTEM_PROMPT = `You read ship-to-ship (STS) transfer nomination emails from marine clients and record only what the email actually states.

Rules:
- If the email does not state a value, return null for it. Never infer, never guess, never fill a plausible default.
- For fields with a fixed list of allowed values, return one of those values verbatim, or null. If the email describes something close to but not exactly an allowed value, return null.
- Vessel names: return the name as written, without the "MT"/"MV" prefix if one is present.
- Quantity: return metric tonnes as a plain number string, digits only. If the email gives another unit, return null.
- Dates and times: return ISO 8601 — "2026-08-12" when only a date is given, "2026-08-12T06:00" when a time is given too. A time with no stated zone is UTC.
- A laycan or date window gives the start: use the first day of the window. Its last day is a cancelling date, not a completion time — never return it as the end. Return an end only when the email actually says when the operation finishes.
- CHS and MS naming varies a lot by client — read for meaning, not just the literal words "CHS"/"MS":
  - MS (Manoeuvring Ship) is the vessel that comes alongside / manoeuvres. Clients often call this the "mother ship" or "mother vessel".
  - CHS (Constant Heading Ship) is the vessel that holds course while the other comes alongside. Clients often call this the "child ship", "daughter ship", or "sister ship".
  - These labels are inconsistent across clients — if the email's own wording contradicts the usual pattern above, or uses some other term, follow what the email actually says about which vessel is holding course versus manoeuvring/coming alongside, not the label alone. If it is genuinely unclear which vessel is which, return null for both rather than guessing.
- description: this is the one field that is a summary rather than a lookup. List, in short plain-text lines, any other operational detail the email states that has no field of its own above — vessel flag, cargo grade, a vessel's cargo capacity, ETA, requested support (superintendent, fenders, hoses, craft), permits/approvals mentioned, or anything else concrete. Only include what the email actually says; do not restate values already captured in the other fields (vessel names, cargo type, quantity, dates, client, agent, location, vessel type). Null if there is nothing left over to note.

A blank field an operator fills in is far better than a wrong one that gets saved.`;

/** Nullable free-text property. */
function nullableString(description) {
  return { type: ["string", "null"], description };
}

/** Nullable property locked to a fixed list of real option values. */
function nullableEnum(values, description) {
  return {
    type: ["string", "null"],
    enum: [...values, null],
    description,
  };
}

/**
 * Build the tool schema from the live dropdown options so the model cannot invent a value.
 * @param {{typeOfOperation: string[], locations: string[], cargoTypes: string[], vesselTypes: string[]}} options
 */
export function buildExtractionTool(options) {
  return {
    name: TOOL_NAME,
    description:
      "Record the STS operation details stated in the email. Use null for anything the email does not state.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        typeOfOperation: nullableEnum(
          options.typeOfOperation,
          "The type of operation, if the email names one."
        ),
        location: nullableEnum(
          options.locations,
          "The transfer location, if the email names one. Must match an allowed location exactly."
        ),
        typeOfCargo: nullableEnum(
          options.cargoTypes,
          "The cargo grade, if the email names one. Must match an allowed cargo type exactly."
        ),
        chs: nullableString(
          "Name of the CHS (Constant Heading Ship) vessel, if stated — often called the child/daughter/sister ship."
        ),
        ms: nullableString(
          "Name of the MS (Manoeuvring Ship) vessel, if stated — often called the mother ship."
        ),
        operationType: nullableEnum(
          options.operationTypes,
          "Whether the transfer is underway or at anchor, if the email says."
        ),
        loaCHS: nullableString("Length overall of the CHS vessel in metres, digits only."),
        loaMS: nullableString("Length overall of the MS vessel in metres, digits only."),
        vesselTypeCHS: nullableEnum(
          options.vesselTypes,
          "Vessel class/type of the CHS vessel (e.g. VLCC, Aframax), if the email states one. Must match an allowed vessel type exactly — pick the closest class named, e.g. \"Aframax Tanker\" is \"Aframax\"."
        ),
        vesselTypeMS: nullableEnum(
          options.vesselTypes,
          "Vessel class/type of the MS vessel (e.g. VLCC, Aframax), if the email states one. Must match an allowed vessel type exactly — pick the closest class named, e.g. \"Aframax Tanker\" is \"Aframax\"."
        ),
        client: nullableString(
          "Client or charterer the operation is for, if named. Organisation name only, verbatim."
        ),
        agent: nullableString(
          "Port or shipping agent, if named. Organisation name only, verbatim."
        ),
        quantity: nullableString("Cargo quantity in metric tonnes, digits only, if stated in MT."),
        operationStartTime: nullableString(
          "When the transfer starts, ISO 8601. The first day of a laycan window. Null if the email does not say."
        ),
        operationEndTime: nullableString(
          "When the transfer is expected to finish, ISO 8601. Null if the email does not say."
        ),
        description: nullableString(
          "Other operational details the email states with no field of their own above — vessel flag, cargo grade, a vessel's capacity, requested support, permits mentioned, etc. Short plain-text lines. Do not repeat values already captured elsewhere."
        ),
      },
      required: [
        "typeOfOperation",
        "location",
        "typeOfCargo",
        "chs",
        "ms",
        "operationType",
        "loaCHS",
        "loaMS",
        "vesselTypeCHS",
        "vesselTypeMS",
        "client",
        "agent",
        "quantity",
        "operationStartTime",
        "operationEndTime",
        "description",
      ],
    },
  };
}

const FIELD_KEYS = [
  "typeOfOperation",
  "location",
  "typeOfCargo",
  "operationType",
  "chs",
  "ms",
  "loaCHS",
  "loaMS",
  "vesselTypeCHS",
  "vesselTypeMS",
  "client",
  "agent",
  "quantity",
  "operationStartTime",
  "operationEndTime",
  "description",
];

/** Free-text fields, kept verbatim rather than checked against an option list. */
const FREE_TEXT_KEYS = { chs: 200, ms: 200, client: 120, agent: 120 };

/** Max length for the free-text `description` catch-all (handled separately — its
 *  line breaks are kept, unlike the single-line fields above). */
const DESCRIPTION_MAX_LENGTH = 2000;

/** Fields that must be a plain number, stored as a digit string. */
const NUMERIC_KEYS = ["loaCHS", "loaMS", "quantity"];

/** Fields carried as `Date` objects rather than strings. */
const DATE_KEYS = ["operationStartTime", "operationEndTime"];

function emptyFields() {
  return FIELD_KEYS.reduce((acc, key) => ({ ...acc, [key]: null }), {});
}

/* =====================
   DATES
====================== */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Plausible range for an operation date — catches a misread year like 20226. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * Build a UTC date from calendar parts, rejecting anything impossible.
 *
 * `Date.UTC` silently rolls 2026-13-01 forward into 2027, and 31 February into
 * March, so every component is checked and the result is compared back against
 * what was asked for.
 */
function utcDate(year, month, day, hour = 0, minute = 0) {
  if (!(year >= MIN_YEAR && year <= MAX_YEAR)) return null;
  if (!(month >= 1 && month <= 12)) return null;
  if (!(day >= 1 && day <= 31)) return null;
  if (!(hour >= 0 && hour <= 23) || !(minute >= 0 && minute <= 59)) return null;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/**
 * Parse the ISO 8601 the tool schema asks the model for: "2026-08-12",
 * "2026-08-12T06:00", optionally with a Z or ±HH:mm offset.
 *
 * A value with no offset is read as UTC rather than server-local time. STS
 * timings are quoted in UTC, and letting the server's zone decide would shift a
 * transfer by hours depending on where the app happens to be deployed.
 */
export function parseIsoDateTime(value) {
  if (typeof value !== "string") return null;

  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(
      value.trim()
    );
  if (!match) return null;

  const [, year, month, day, hour, minute, offset] = match;
  const base = utcDate(Number(year), Number(month), Number(day), Number(hour || 0), Number(minute || 0));
  if (!base || !offset || offset.toUpperCase() === "Z") return base;

  const [offsetHours, offsetMinutes] = offset.slice(1).replace(":", "").match(/\d{2}/g).map(Number);
  const shift = (offsetHours * 60 + offsetMinutes) * 60000;
  return new Date(base.getTime() + (offset[0] === "-" ? shift : -shift));
}

/** "12 Aug 2026", "12-Aug-2026", optionally followed by 0600 / 06:00. */
const PROSE_DATE =
  /\b(\d{1,2})[\s-]+([a-z]{3,9})[\s-]+(\d{4})\b(?:[\s,]+(?:at\s+)?(\d{1,2}):?(\d{2})\s*(?:hrs|hours|lt|utc|gmt)?)?/i;

/** "2026-08-12", optionally followed by 06:00. */
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b(?:[T\s](\d{1,2}):(\d{2}))?/;

/**
 * A window sharing one month and year — "10–14 August 2026", "10 to 14 Aug 2026".
 * Matched before the single-date forms because the leftmost single-date match
 * inside "10–14 August 2026" is the *14th*: the day the window closes, not the
 * day it opens.
 */
const DATE_RANGE = /\b(\d{1,2})\s*(?:–|—|-|to|until|till)\s*(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})\b/i;

/**
 * Read a date out of prose, without a model.
 *
 * Deliberately narrow: an ISO date, or a date with a spelled-out month. All
 * numeric forms such as 12/08/2026 are ignored on purpose — DD/MM and MM/DD
 * cannot be told apart, and starting an operation on the wrong day is far worse
 * than leaving the field for the operator to fill in.
 */
export function parseProseDate(text) {
  const source = String(text || "");

  /* A window resolves to the day it opens — the earliest the operation can
     begin. Must run first; see DATE_RANGE. */
  const range = DATE_RANGE.exec(source);
  if (range) {
    const month = MONTHS[range[3].slice(0, 3).toLowerCase()];
    if (month) {
      const date = utcDate(Number(range[4]), month, Number(range[1]));
      if (date) return date;
    }
  }

  const iso = ISO_DATE.exec(source);
  if (iso) {
    const date = utcDate(
      Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] || 0), Number(iso[5] || 0)
    );
    if (date) return date;
  }

  const prose = PROSE_DATE.exec(source);
  if (prose) {
    const month = MONTHS[prose[2].slice(0, 3).toLowerCase()];
    if (month) {
      const date = utcDate(
        Number(prose[3]), month, Number(prose[1]), Number(prose[4] || 0), Number(prose[5] || 0)
      );
      if (date) return date;
    }
  }

  return null;
}

/** Labels naming the moment the operation begins. */
const START_LABELS = ["operation start", "start date", "commencement", "commencing", "eta"];

/* A laycan is the laydays/cancelling window. Its opening day is the earliest the
   operation may begin, so it is a reasonable start when nothing more precise is
   given — but its closing day is the date the charter can be cancelled, NOT a
   completion time, so it deliberately never becomes operationEndTime. */
const LAYCAN_LABELS = ["laycan", "laydays"];

const END_LABELS = ["operation end", "end date", "completion", "etd", "etc"];

/** Pull a date from an explicitly labelled line, e.g. "Operation start: 12 Aug 2026". */
function matchLabelledDate(text, labels) {
  const pattern = new RegExp(`\\b(?:${labels.join("|")})\\b[^:\\n=]*[:=]\\s*(.+)$`, "i");

  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) continue;
    const date = parseProseDate(match[1]);
    if (date) return date;
  }
  return null;
}

/**
 * The address out of a From header — "Ops Desk <ops@client.com>" → "ops@client.com".
 * Returns null unless the result actually looks like an address, so a malformed
 * header never reaches the master data.
 */
export function senderEmailAddress(from) {
  const source = String(from || "").trim();
  const angled = /<([^>]+)>/.exec(source);
  const candidate = (angled ? angled[1] : source).trim().toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

/**
 * Re-check model output against the real option lists. Anything that is not a genuine
 * option becomes null. Called by the route so a model mistake can never reach the record.
 */
export function sanitizeExtractedFields(raw, options) {
  const out = emptyFields();
  if (!raw || typeof raw !== "object") return out;

  const pickFrom = (value, allowed) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return allowed.includes(trimmed) ? trimmed : null;
  };

  out.typeOfOperation = pickFrom(raw.typeOfOperation, options.typeOfOperation);
  out.location = pickFrom(raw.location, options.locations);
  out.typeOfCargo = pickFrom(raw.typeOfCargo, options.cargoTypes);
  out.operationType = pickFrom(raw.operationType, options.operationTypes || []);
  out.vesselTypeCHS = pickFrom(raw.vesselTypeCHS, options.vesselTypes || []);
  out.vesselTypeMS = pickFrom(raw.vesselTypeMS, options.vesselTypes || []);

  for (const [key, maxLength] of Object.entries(FREE_TEXT_KEYS)) {
    const value = typeof raw[key] === "string" ? raw[key].trim().replace(/\s+/g, " ") : "";
    out[key] = value ? value.slice(0, maxLength) : null;
  }

  /* Unlike the single-line fields above, description keeps its line breaks —
     collapsing them would turn a readable multi-line summary into one long run-on line. */
  const descriptionValue =
    typeof raw.description === "string" ? raw.description.trim().replace(/[ \t]+/g, " ") : "";
  out.description = descriptionValue ? descriptionValue.slice(0, DESCRIPTION_MAX_LENGTH) : null;

  for (const key of NUMERIC_KEYS) {
    const value = typeof raw[key] === "string" ? raw[key].trim().replace(/[,\s]/g, "") : "";
    out[key] = value && /^\d+(\.\d+)?$/.test(value) ? value : null;
  }

  /* Accepts either shape: the model returns ISO strings, the deterministic pass
     returns Dates, and this runs over both (and over its own output when the
     route re-validates the merged result). */
  for (const key of DATE_KEYS) {
    const value = raw[key];
    if (value instanceof Date) out[key] = Number.isNaN(value.getTime()) ? null : value;
    else out[key] = parseIsoDateTime(value);
  }

  /* An end at or before the start is a misreading, not a real timing. Keep the
     start — the record requires one — and leave the end for the operator. */
  if (out.operationStartTime && out.operationEndTime && out.operationEndTime <= out.operationStartTime) {
    out.operationEndTime = null;
  }

  return out;
}

/**
 * Ask Claude to read the email, constrained to the supplied option lists.
 * Returns the raw tool input; the caller must still run `sanitizeExtractedFields`.
 */
export async function extractFieldsFromEmail({ subject, bodyText, options }) {
  const text = `${subject ? `Subject: ${subject}\n\n` : ""}${bodyText || ""}`.trim();
  if (!text) return emptyFields();

  const client = new Anthropic();
  const tool = buildExtractionTool(options);

  const response = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low" },
    tools: [tool],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: text }],
  });

  const block = response.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
  return block ? block.input : emptyFields();
}

/**
 * Ask OpenAI to read the email, constrained to the supplied option lists — same schema,
 * same system prompt, and the same "null over a guess" contract as the Claude path above.
 * Returns the raw structured output; the caller must still run `sanitizeExtractedFields`.
 */
export async function extractFieldsFromEmailOpenAI({ subject, bodyText, options }) {
  const text = `${subject ? `Subject: ${subject}\n\n` : ""}${bodyText || ""}`.trim();
  if (!text) return emptyFields();

  const client = new OpenAI();
  const schema = buildExtractionTool(options).input_schema;

  const response = await client.chat.completions.create({
    model: OPENAI_EXTRACTION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: TOOL_NAME, strict: true, schema },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) return emptyFields();

  try {
    return JSON.parse(raw);
  } catch {
    return emptyFields();
  }
}

/* =====================
   DETERMINISTIC EXTRACTION (no API key required)
====================== */

export function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

/** Lowercase with punctuation flattened, so option names match regardless of formatting. */
function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Find which of `options` the text mentions.
 * Exact whole-phrase matching against real option values — not inference.
 * Prefers the most specific (longest) match; returns null when two equally specific
 * options both match, since that is genuinely ambiguous.
 */
export function matchOption(text, options) {
  const haystack = ` ${normalizeForMatch(text)} `;
  if (haystack.trim() === "") return null;

  const matches = [];
  for (const option of options) {
    const needle = normalizeForMatch(option);
    if (!needle) continue;
    if (haystack.includes(` ${needle} `)) matches.push({ option, needle });
  }
  if (matches.length === 0) return null;

  /* Discard matches nested inside a longer one — "Fujairah" inside "Fujairah OPL" is
     the same mention, so the specific option wins. Two matches that are *not* nested
     mean the email named two different options, which is ambiguous. */
  const maximal = matches.filter(
    (match) => !matches.some((other) => other !== match && other.needle.includes(match.needle))
  );

  return maximal.length === 1 ? maximal[0].option : null;
}

/** Trim a captured vessel name and drop any MT/MV/MS prefix, matching the model's instructions. */
function cleanVesselName(raw) {
  let value = String(raw || "").split(/[,;(\[]/)[0].trim();
  value = value.replace(/^m[\/.]?\s?[tvs]\b\.?\s*/i, "").trim();
  value = value.replace(/["'.\s]+$/, "").trim();
  return value.length >= 2 && value.length <= 60 ? value : null;
}

/**
 * Trim a captured organisation name. Unlike vessels, commas are kept —
 * "Shell Trading, Ltd" is one name, not a name followed by a note.
 */
function cleanOrganisationName(raw) {
  const value = String(raw || "")
    .split(/[(\[]/)[0]
    .replace(/["'.,;\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length >= 2 && value.length <= 120 ? value : null;
}

/**
 * Pull a value from an explicitly labelled line, e.g. "CHS: MT STELLA" or "Client: Shell".
 * Labelled lines only — an unlabelled name in prose is too ambiguous to attribute.
 */
function matchLabelledValue(text, labels, clean) {
  const pattern = new RegExp(
    `\\b(?:${labels.join("|")})\\b\\s*(?:vessel|ship|name)?\\s*[:\\-–—=]\\s*(.+)$`,
    "i"
  );

  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) continue;
    const value = clean(match[1]);
    if (value) return value;
  }
  return null;
}

/* CHS (Constant Heading Ship) is commonly called the child/daughter/sister ship;
   MS (Manoeuvring Ship) is commonly called the mother ship. Backwards from what these
   used to say — corrected per the actual convention this app's clients use.
   Matches either a labelled value on the line ("Mother Vessel: MT X") or the label alone
   as its own heading line ("Mother Vessel", with details following on later lines). */
const CHS_LABEL = /\b(?:chs|child|daughter|sister|discharging)\b\s*(?:vessel|ship)?\s*(?:[:\-–—=]|$)/i;
const MS_LABEL = /\b(?:ms|mother|receiving)\b\s*(?:vessel|ship)?\s*(?:[:\-–—=]|$)/i;
const LOA_LINE = /\bloa\b[^:\-–—=\n]*[:\-–—=]\s*([\d.,\s]+)/i;

/**
 * LOA lines carry no vessel of their own — "LOA: 20000" belongs to whichever vessel was
 * named above it. Walk the lines keeping track of the vessel most recently opened, and
 * attribute each LOA to it. An LOA before any vessel line is ignored rather than guessed.
 */
export function matchVesselLoa(text) {
  const result = { loaCHS: null, loaMS: null };
  let current = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (CHS_LABEL.test(line)) current = "loaCHS";
    else if (MS_LABEL.test(line)) current = "loaMS";

    const match = line.match(LOA_LINE);
    if (!match || !current || result[current]) continue;

    const digits = match[1].replace(/[,\s]/g, "");
    if (/^\d+(\.\d+)?$/.test(digits)) result[current] = digits;
  }

  return result;
}

const VESSEL_TYPE_LINE = /\b(?:vessel\s*type|type\s*of\s*vessel)\b[^:\-–—=\n]*[:\-–—=]\s*(.+)$/i;

/**
 * Same attribution as `matchVesselLoa`: a "Vessel Type: VLCC" line belongs to whichever
 * vessel was named most recently. Matched only against the real vessel-type options, so
 * an unrecognised class (or one the model already declined) is left null, not guessed.
 */
export function matchVesselType(text, vesselTypeOptions) {
  const result = { vesselTypeCHS: null, vesselTypeMS: null };
  if (!vesselTypeOptions?.length) return result;
  let current = null;

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (CHS_LABEL.test(line)) current = "vesselTypeCHS";
    else if (MS_LABEL.test(line)) current = "vesselTypeMS";

    const match = line.match(VESSEL_TYPE_LINE);
    if (!match || !current || result[current]) continue;

    const value = matchOption(match[1], vesselTypeOptions);
    if (value) result[current] = value;
  }

  return result;
}

/** Quantity in metric tonnes only — other units are left for the operator. */
function matchQuantity(text) {
  const match = String(text || "").match(
    /\b(\d[\d,\s]*(?:\.\d+)?)\s*(?:mt\b|m\.\s*t\.|metric\s+tonnes?\b|metric\s+tons?\b|tonnes?\b)/i
  );
  if (!match) return null;

  const digits = match[1].replace(/[,\s]/g, "");
  return /^\d+(\.\d+)?$/.test(digits) ? digits : null;
}

/**
 * Extract what can be determined without a model: option values quoted verbatim in the
 * email, explicitly labelled vessel names, and a quantity given in MT.
 * Anything less than certain is left null for the operator.
 */
export function extractFieldsDeterministically({ subject, bodyText, options }) {
  const text = `${subject || ""}\n${bodyText || ""}`;
  const fields = emptyFields();
  if (!text.trim()) return fields;

  fields.typeOfOperation = matchOption(text, options.typeOfOperation);
  fields.location = matchOption(text, options.locations);
  fields.typeOfCargo = matchOption(text, options.cargoTypes);
  fields.chs = matchLabelledValue(text, ["chs", "child", "daughter", "sister", "discharging"], cleanVesselName);
  fields.ms = matchLabelledValue(text, ["ms", "mother", "receiving"], cleanVesselName);
  fields.client = matchLabelledValue(text, ["client", "charterer"], cleanOrganisationName);
  fields.agent = matchLabelledValue(text, ["agent", "agency"], cleanOrganisationName);
  fields.operationType = matchOption(text, options.operationTypes || []);
  fields.quantity = matchQuantity(text);

  const { loaCHS, loaMS } = matchVesselLoa(text);
  fields.loaCHS = loaCHS;
  fields.loaMS = loaMS;

  const { vesselTypeCHS, vesselTypeMS } = matchVesselType(text, options.vesselTypes || []);
  fields.vesselTypeCHS = vesselTypeCHS;
  fields.vesselTypeMS = vesselTypeMS;

  /* An explicit start beats a laycan window: the window says when the operation
     may begin, an explicit line says when it does. */
  fields.operationStartTime =
    matchLabelledDate(text, START_LABELS) || matchLabelledDate(text, LAYCAN_LABELS);
  fields.operationEndTime = matchLabelledDate(text, END_LABELS);

  return fields;
}

/**
 * Extract operation fields with a model when a key is configured, falling back to
 * deterministic matching when neither key is set — or when the model call fails.
 * Prefers OpenAI (the key actually provisioned for this) over Claude when both are set.
 *
 * @returns {Promise<{fields: object, method: "model"|"model-openai"|"deterministic"|"deterministic-fallback"}>}
 */
export async function extractFields({ subject, bodyText, options }) {
  const deterministic = extractFieldsDeterministically({ subject, bodyText, options });

  const useOpenAI = hasOpenAIKey();
  const useClaude = !useOpenAI && hasAnthropicKey();

  if (!useOpenAI && !useClaude) {
    return { fields: deterministic, method: "deterministic" };
  }

  try {
    const raw = useOpenAI
      ? await extractFieldsFromEmailOpenAI({ subject, bodyText, options })
      : await extractFieldsFromEmail({ subject, bodyText, options });
    const modelFields = sanitizeExtractedFields(raw, options);

    // Deterministic matches are exact hits on real option values, so they are safe
    // to use wherever the model declined to answer.
    const merged = { ...modelFields };
    for (const key of FIELD_KEYS) {
      if (!merged[key] && deterministic[key]) merged[key] = deterministic[key];
    }

    return { fields: merged, method: useOpenAI ? "model-openai" : "model" };
  } catch (error) {
    console.error(
      `${useOpenAI ? "OpenAI" : "Claude"} extraction unavailable, falling back to deterministic matching:`,
      error?.message || error
    );
    return { fields: deterministic, method: "deterministic-fallback" };
  }
}

/* =====================
   ATTACHMENT ROUTING (deterministic)
====================== */

/** Slots that belong to the operation as a whole, not to one vessel. */
const SHARED_DOC_PATTERNS = [
  { slot: "jpo", patterns: [/\bjoint plan\b/, /\bjpo\b/] },
  { slot: "riskAssessment", patterns: [/\brisk assessment\b/, /\brisk assmt\b/] },
  { slot: "mooringPlan", patterns: [/\bmooring plan\b/] },
];

/** Slots that exist once per vessel; resolved into `chs…` / `ms…`. */
const VESSEL_DOC_PATTERNS = [
  { suffix: "Q88", patterns: [/\bq ?88\b/] },
  { suffix: "SSQ", patterns: [/\bssq\b/] },
  { suffix: "MSDS", patterns: [/\bmsds\b/, /\bsafety data sheet\b/] },
  { suffix: "GAPlan", patterns: [/\bga plan\b/, /\bgeneral arrangement\b/] },
  { suffix: "MooringArrangement", patterns: [/\bmooring arrangement\b/, /\bmooring arr\b/] },
  { suffix: "Indemnity", patterns: [/\bindemnity\b/, /\bloi\b/] },
];

/**
 * Keyword fallback when the filename carries no vessel name.
 * CHS (Constant Heading Ship) is commonly called the child/daughter/sister ship;
 * MS (Manoeuvring Ship) is commonly called the mother ship.
 */
const VESSEL_KEYWORDS = {
  chs: [/\bchs\b/, /\bchild\b/, /\bdaughter\b/, /\bsister\b/, /\bdischarging\b/],
  ms: [/\bms\b/, /\bmother\b/, /\breceiving\b/],
};

/** Lowercase, separators collapsed to spaces so `\b` boundaries behave. */
function spaced(filename) {
  return String(filename || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compact form for substring matching of vessel names. */
function compact(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Match forms of a vessel name worth testing against a filename.
 * Includes the name with any MT/MV/MS prefix removed, since filenames often drop it.
 */
function vesselTokens(name) {
  const full = compact(name);
  const tokens = [];
  if (full.length >= 4) tokens.push(full);

  const stripped = compact(String(name || "").replace(/^\s*m[\/.\s]*[tvs]\b\.?\s*/i, ""));
  if (stripped.length >= 4 && stripped !== full) tokens.push(stripped);

  return tokens;
}

function matchesAny(haystack, patterns) {
  return patterns.some((re) => re.test(haystack));
}

/**
 * Decide which vessel a filename refers to.
 * @returns {"chs"|"ms"|null} null when unknown or genuinely ambiguous
 */
export function resolveVessel(filename, { chsName, msName } = {}) {
  const flat = compact(filename);
  const words = spaced(filename);

  const chsNamed = vesselTokens(chsName).some((t) => flat.includes(t));
  const msNamed = vesselTokens(msName).some((t) => flat.includes(t));
  if (chsNamed && !msNamed) return "chs";
  if (msNamed && !chsNamed) return "ms";
  if (chsNamed && msNamed) return null;

  const chsKeyword = matchesAny(words, VESSEL_KEYWORDS.chs);
  const msKeyword = matchesAny(words, VESSEL_KEYWORDS.ms);
  if (chsKeyword && !msKeyword) return "chs";
  if (msKeyword && !chsKeyword) return "ms";

  return null;
}

/**
 * Work out the document slot for a single filename.
 * @returns {string|null} slot name, or null when the type or vessel is unclear
 */
export function resolveSlot(filename, { chsName, msName } = {}) {
  const words = spaced(filename);
  if (!words) return null;

  for (const { slot, patterns } of SHARED_DOC_PATTERNS) {
    if (matchesAny(words, patterns)) return slot;
  }

  for (const { suffix, patterns } of VESSEL_DOC_PATTERNS) {
    if (!matchesAny(words, patterns)) continue;
    const vessel = resolveVessel(filename, { chsName, msName });
    return vessel ? `${vessel}${suffix}` : null;
  }

  return null;
}

/**
 * File a set of attachments into document slots.
 * Anything whose type or vessel is unclear — and any second file competing for a slot
 * already taken — goes to the general attachments list rather than a guessed slot.
 *
 * @param {{attachments: Array<{filename: string}>, chsName?: string, msName?: string}} input
 * @returns {{documents: Record<string, object>, unrouted: Array<object>}}
 */
export function routeAttachments({ attachments = [], chsName, msName } = {}) {
  const documents = {};
  const unrouted = [];

  for (const attachment of attachments) {
    const slot = resolveSlot(attachment?.filename, { chsName, msName });
    if (slot && !documents[slot]) {
      documents[slot] = attachment;
    } else {
      unrouted.push(attachment);
    }
  }

  return { documents, unrouted };
}
