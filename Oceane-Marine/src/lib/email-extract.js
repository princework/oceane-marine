import Anthropic from "@anthropic-ai/sdk";

/**
 * Turning a client nomination email into STS operation data.
 *
 * Two independent halves:
 *  - `extractFieldsFromEmail` reads the prose with Claude, constrained to real dropdown values.
 *  - `routeAttachments` files PDFs by filename only. No model involvement — a Q88 filed
 *    under the wrong vessel is worse than one left unfiled.
 */

const EXTRACTION_MODEL = "claude-sonnet-4-6";
const TOOL_NAME = "record_sts_nomination";

const SYSTEM_PROMPT = `You read ship-to-ship (STS) transfer nomination emails from marine clients and record only what the email actually states.

Rules:
- If the email does not state a value, return null for it. Never infer, never guess, never fill a plausible default.
- For fields with a fixed list of allowed values, return one of those values verbatim, or null. If the email describes something close to but not exactly an allowed value, return null.
- Vessel names: return the name as written, without the "MT"/"MV" prefix if one is present.
- Quantity: return metric tonnes as a plain number string, digits only. If the email gives another unit, return null.

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
 * @param {{typeOfOperation: string[], locations: string[], cargoTypes: string[]}} options
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
        chs: nullableString("Name of the CHS / mother vessel, if stated."),
        ms: nullableString("Name of the MS / daughter vessel, if stated."),
        operationType: nullableEnum(
          options.operationTypes,
          "Whether the transfer is underway or at anchor, if the email says."
        ),
        loaCHS: nullableString("Length overall of the CHS vessel in metres, digits only."),
        loaMS: nullableString("Length overall of the MS vessel in metres, digits only."),
        client: nullableString(
          "Client or charterer the operation is for, if named. Organisation name only, verbatim."
        ),
        agent: nullableString(
          "Port or shipping agent, if named. Organisation name only, verbatim."
        ),
        quantity: nullableString("Cargo quantity in metric tonnes, digits only, if stated in MT."),
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
        "client",
        "agent",
        "quantity",
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
  "client",
  "agent",
  "quantity",
];

/** Free-text fields, kept verbatim rather than checked against an option list. */
const FREE_TEXT_KEYS = { chs: 200, ms: 200, client: 120, agent: 120 };

/** Fields that must be a plain number, stored as a digit string. */
const NUMERIC_KEYS = ["loaCHS", "loaMS", "quantity"];

function emptyFields() {
  return FIELD_KEYS.reduce((acc, key) => ({ ...acc, [key]: null }), {});
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

  for (const [key, maxLength] of Object.entries(FREE_TEXT_KEYS)) {
    const value = typeof raw[key] === "string" ? raw[key].trim().replace(/\s+/g, " ") : "";
    out[key] = value ? value.slice(0, maxLength) : null;
  }

  for (const key of NUMERIC_KEYS) {
    const value = typeof raw[key] === "string" ? raw[key].trim().replace(/[,\s]/g, "") : "";
    out[key] = value && /^\d+(\.\d+)?$/.test(value) ? value : null;
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

/* =====================
   DETERMINISTIC EXTRACTION (no API key required)
====================== */

export function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
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

const CHS_LABEL = /\b(?:chs|mother|discharging)\b\s*(?:vessel|ship)?\s*[:\-–—=]/i;
const MS_LABEL = /\b(?:ms|daughter|receiving)\b\s*(?:vessel|ship)?\s*[:\-–—=]/i;
const LOA_LINE = /\bloa\b[^:\-–—=\n]*[:\-–—=]\s*([\d.,\s]+)/i;

/**
 * LOA lines carry no vessel of their own — "LOA: 20000" belongs to whichever vessel was
 * named above it. Walk the lines keeping track of the vessel most recently opened, and
 * attribute each LOA to it. An LOA before any vessel line is ignored rather than guessed.
 */
export function matchVesselLoa(text) {
  const result = { loaCHS: null, loaMS: null };
  let current = null;

  for (const line of String(text || "").split(/\r?\n/)) {
    if (CHS_LABEL.test(line)) current = "loaCHS";
    else if (MS_LABEL.test(line)) current = "loaMS";

    const match = line.match(LOA_LINE);
    if (!match || !current || result[current]) continue;

    const digits = match[1].replace(/[,\s]/g, "");
    if (/^\d+(\.\d+)?$/.test(digits)) result[current] = digits;
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
  fields.chs = matchLabelledValue(text, ["chs", "mother", "discharging"], cleanVesselName);
  fields.ms = matchLabelledValue(text, ["ms", "daughter", "receiving"], cleanVesselName);
  fields.client = matchLabelledValue(text, ["client", "charterer"], cleanOrganisationName);
  fields.agent = matchLabelledValue(text, ["agent", "agency"], cleanOrganisationName);
  fields.operationType = matchOption(text, options.operationTypes || []);
  fields.quantity = matchQuantity(text);

  const { loaCHS, loaMS } = matchVesselLoa(text);
  fields.loaCHS = loaCHS;
  fields.loaMS = loaMS;

  return fields;
}

/**
 * Extract operation fields, using Claude when a key is configured and falling back to
 * deterministic matching when it is not — or when the model call fails.
 *
 * @returns {Promise<{fields: object, method: "model"|"deterministic"|"deterministic-fallback"}>}
 */
export async function extractFields({ subject, bodyText, options }) {
  const deterministic = extractFieldsDeterministically({ subject, bodyText, options });

  if (!hasAnthropicKey()) {
    return { fields: deterministic, method: "deterministic" };
  }

  try {
    const raw = await extractFieldsFromEmail({ subject, bodyText, options });
    const modelFields = sanitizeExtractedFields(raw, options);

    // Deterministic matches are exact hits on real option values, so they are safe
    // to use wherever the model declined to answer.
    const merged = { ...modelFields };
    for (const key of FIELD_KEYS) {
      if (!merged[key] && deterministic[key]) merged[key] = deterministic[key];
    }

    return { fields: merged, method: "model" };
  } catch (error) {
    console.error(
      "Claude extraction unavailable, falling back to deterministic matching:",
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
 * CHS is the mother ship and MS the daughter ship, per the form's own labels.
 */
const VESSEL_KEYWORDS = {
  chs: [/\bchs\b/, /\bmother\b/, /\bdischarging\b/],
  ms: [/\bms\b/, /\bdaughter\b/, /\breceiving\b/],
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
