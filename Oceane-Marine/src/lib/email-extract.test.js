import test from "node:test";
import assert from "node:assert/strict";

import {
  routeAttachments,
  resolveSlot,
  resolveVessel,
  matchOption,
  extractFieldsDeterministically,
  sanitizeExtractedFields,
  parseIsoDateTime,
  parseProseDate,
  senderEmailAddress,
} from "./email-extract.js";

/** Attachment descriptors as `getMessageDetail` returns them. */
function attachment(filename) {
  return { filename, mimeType: "application/pdf", attachmentId: `att-${filename}`, size: 1024 };
}

const VESSELS = { chsName: "MT STELLA", msName: "ATLANTIC TRADER" };

test("a clean Q88 filename carrying the CHS vessel name lands in the CHS Q88 slot", () => {
  const { documents, unrouted } = routeAttachments({
    attachments: [attachment("Q88_MTSTELLA.pdf")],
    ...VESSELS,
  });

  assert.equal(Object.keys(documents).length, 1);
  assert.equal(documents.chsQ88.filename, "Q88_MTSTELLA.pdf");
  assert.deepEqual(unrouted, []);
});

test("an SSQ with no vessel hint goes to general attachments, not a guessed slot", () => {
  const { documents, unrouted } = routeAttachments({
    attachments: [attachment("SSQ.pdf")],
    ...VESSELS,
  });

  assert.deepEqual(documents, {}, "must not guess a vessel");
  assert.equal(unrouted.length, 1);
  assert.equal(unrouted[0].filename, "SSQ.pdf");
});

test("a joint plan lands in the pre-STS JPO slot regardless of vessel", () => {
  const { documents, unrouted } = routeAttachments({
    attachments: [attachment("Joint Plan Operation.pdf")],
    ...VESSELS,
  });

  assert.equal(documents.jpo.filename, "Joint Plan Operation.pdf");
  assert.deepEqual(unrouted, []);
});

test("vessel keywords resolve a slot when no vessel name is present", () => {
  const { documents } = routeAttachments({
    attachments: [attachment("MS_MSDS.pdf"), attachment("CHS Mooring Arrangement.pdf")],
    ...VESSELS,
  });

  assert.equal(documents.msMSDS.filename, "MS_MSDS.pdf");
  assert.equal(documents.chsMooringArrangement.filename, "CHS Mooring Arrangement.pdf");
});

test("a filename naming both vessels is treated as ambiguous", () => {
  assert.equal(resolveVessel("Q88 MTSTELLA and ATLANTIC TRADER.pdf", VESSELS), null);

  const { documents, unrouted } = routeAttachments({
    attachments: [attachment("Q88 MTSTELLA and ATLANTIC TRADER.pdf")],
    ...VESSELS,
  });
  assert.deepEqual(documents, {});
  assert.equal(unrouted.length, 1);
});

test("a second file competing for a taken slot goes to general attachments", () => {
  const { documents, unrouted } = routeAttachments({
    attachments: [attachment("Q88_MTSTELLA.pdf"), attachment("Q88_MTSTELLA_rev2.pdf")],
    ...VESSELS,
  });

  assert.equal(documents.chsQ88.filename, "Q88_MTSTELLA.pdf", "first file wins");
  assert.equal(unrouted.length, 1);
  assert.equal(unrouted[0].filename, "Q88_MTSTELLA_rev2.pdf");
});

test("mooring plan and mooring arrangement are different slots", () => {
  assert.equal(resolveSlot("Mooring Plan.pdf", VESSELS), "mooringPlan");
  assert.equal(resolveSlot("MTSTELLA Mooring Arr.pdf", VESSELS), "chsMooringArrangement");
});

test("an unrecognised document type is never filed", () => {
  assert.equal(resolveSlot("Invoice 4471.pdf", VESSELS), null);
  assert.equal(resolveSlot("Mooring.pdf", VESSELS), null, "bare 'mooring' is ambiguous");
});

test("the MT/MV prefix is optional when matching a vessel name", () => {
  assert.equal(resolveVessel("SSQ_STELLA.pdf", VESSELS), "chs");
  assert.equal(resolveVessel("SSQ_MT_STELLA.pdf", VESSELS), "chs");
});

/* =====================
   Deterministic extraction (used when no Anthropic key is configured)
====================== */

const OPTIONS = {
  typeOfOperation: ["Ship to Ship", "POAC", "Fender Hire", "Hose hire"],
  operationTypes: ["underway", "At Anchor"],
  locations: ["Fujairah", "Fujairah OPL", "Khor Fakkan"],
  cargoTypes: ["Fuel Oil", "Gasoil", "Crude Oil"],
};

test("option matching prefers the most specific match", () => {
  assert.equal(matchOption("Transfer at Fujairah OPL next week", OPTIONS.locations), "Fujairah OPL");
  assert.equal(matchOption("Transfer at Fujairah next week", OPTIONS.locations), "Fujairah");
});

test("option matching returns null rather than picking between equal candidates", () => {
  assert.equal(matchOption("Either Gasoil or Fuel Oil", OPTIONS.cargoTypes), null);
  assert.equal(matchOption("No location named here", OPTIONS.locations), null);
});

test("option matching ignores punctuation and casing differences", () => {
  assert.equal(matchOption("operation type: SHIP-TO-SHIP", OPTIONS.typeOfOperation), "Ship to Ship");
});

test("a realistic nomination email is read without a model", () => {
  const fields = extractFieldsDeterministically({
    subject: "STS Nomination - Fujairah OPL",
    bodyText: [
      "Good morning,",
      "",
      "Please arrange a Ship to Ship transfer at Fujairah OPL.",
      "CHS: MT STELLA",
      "MS: MV ATLANTIC TRADER",
      "Cargo: Fuel Oil",
      "Quantity: 80,000 MT",
    ].join("\n"),
    options: OPTIONS,
  });

  assert.deepEqual(fields, {
    typeOfOperation: "Ship to Ship",
    location: "Fujairah OPL",
    typeOfCargo: "Fuel Oil",
    operationType: null,
    chs: "STELLA",
    ms: "ATLANTIC TRADER",
    loaCHS: null,
    loaMS: null,
    vesselTypeCHS: null,
    vesselTypeMS: null,
    client: null,
    agent: null,
    quantity: "80000",
    operationStartTime: null,
    operationEndTime: null,
    description: null,
  });
});

test("client and agent are read from labelled lines", () => {
  const fields = extractFieldsDeterministically({
    subject: "Nomination",
    bodyText: [
      "Client: Shell Trading, Ltd",
      "Agent: Gulf Marine Agencies",
      "Cargo: Gasoil",
    ].join("\n"),
    options: OPTIONS,
  });

  assert.equal(fields.client, "Shell Trading, Ltd", "commas belong to an organisation name");
  assert.equal(fields.agent, "Gulf Marine Agencies");
  assert.equal(fields.typeOfCargo, "Gasoil");
});

test("charterer and agency are accepted as alternative labels", () => {
  const fields = extractFieldsDeterministically({
    subject: "",
    bodyText: "Charterer - Vitol SA\nAgency = Fujairah Port Services",
    options: OPTIONS,
  });

  assert.equal(fields.client, "Vitol SA");
  assert.equal(fields.agent, "Fujairah Port Services");
});

test("each LOA is attributed to the vessel named above it", () => {
  const fields = extractFieldsDeterministically({
    subject: "",
    bodyText: [
      "Operation Type : At Anchor",
      "CHS: MT STELLA",
      "LOA: 20000",
      "MS: MV ATLANTIC TRADER",
      "LOA :10000",
    ].join("\n"),
    options: OPTIONS,
  });

  assert.equal(fields.chs, "STELLA");
  assert.equal(fields.loaCHS, "20000");
  assert.equal(fields.ms, "ATLANTIC TRADER");
  assert.equal(fields.loaMS, "10000");
  assert.equal(fields.operationType, "At Anchor");
});

test("an LOA before any vessel line is ignored rather than guessed", () => {
  const fields = extractFieldsDeterministically({
    subject: "",
    bodyText: "LOA: 20000\nCHS: MT STELLA",
    options: OPTIONS,
  });

  assert.equal(fields.loaCHS, null, "cannot know which vessel it belongs to");
  assert.equal(fields.loaMS, null);
});

test("labels tolerate a space before the colon", () => {
  const fields = extractFieldsDeterministically({
    subject: "",
    bodyText: "Agent : Rohit Rawat\nClient : Prince",
    options: OPTIONS,
  });

  assert.equal(fields.agent, "Rohit Rawat");
  assert.equal(fields.client, "Prince");
});

test("an unlabelled company name is not attributed to client or agent", () => {
  const fields = extractFieldsDeterministically({
    subject: "Nomination from Shell Trading",
    bodyText: "Shell Trading would like to nominate a transfer.",
    options: OPTIONS,
  });

  assert.equal(fields.client, null);
  assert.equal(fields.agent, null);
});

test("unlabelled vessel names and non-MT quantities are left blank", () => {
  const fields = extractFieldsDeterministically({
    subject: "Nomination",
    bodyText: "Vessels MT STELLA and MV ATLANTIC TRADER. Quantity 5000 barrels.",
    options: OPTIONS,
  });

  assert.equal(fields.chs, null, "an unlabelled vessel could be either ship");
  assert.equal(fields.ms, null);
  assert.equal(fields.quantity, null, "barrels are not metric tonnes");
});

test("an empty email yields all nulls, never guesses", () => {
  const fields = extractFieldsDeterministically({ subject: "", bodyText: "", options: OPTIONS });
  assert.ok(Object.keys(fields).length > 0);
  assert.ok(
    Object.values(fields).every((value) => value === null),
    "every field must be null, never a guess"
  );
});

/* =====================
   DATES
====================== */

test("an ISO date with no offset is read as UTC, not server-local time", () => {
  // Server-local parsing would shift the operation by hours depending on where
  // the app is deployed.
  assert.equal(parseIsoDateTime("2026-08-12").toISOString(), "2026-08-12T00:00:00.000Z");
  assert.equal(parseIsoDateTime("2026-08-12T06:30").toISOString(), "2026-08-12T06:30:00.000Z");
  assert.equal(parseIsoDateTime("2026-08-12T06:30:00Z").toISOString(), "2026-08-12T06:30:00.000Z");
});

test("an explicit offset is converted back to UTC", () => {
  assert.equal(parseIsoDateTime("2026-08-12T06:30+04:00").toISOString(), "2026-08-12T02:30:00.000Z");
  assert.equal(parseIsoDateTime("2026-08-12T06:30-0500").toISOString(), "2026-08-12T11:30:00.000Z");
});

test("impossible calendar dates are rejected rather than rolled over", () => {
  // Date.UTC turns these into a different day without complaining.
  for (const value of ["2026-02-31", "2026-13-01", "2026-08-32", "2026-08-12T25:00"]) {
    assert.equal(parseIsoDateTime(value), null, `expected null for ${value}`);
  }
});

test("a year outside the plausible range is rejected", () => {
  assert.equal(parseIsoDateTime("1026-08-12"), null);
  assert.equal(parseIsoDateTime("9026-08-12"), null);
});

test("prose dates are read only in unambiguous forms", () => {
  assert.equal(parseProseDate("on 12 Aug 2026").toISOString(), "2026-08-12T00:00:00.000Z");
  assert.equal(parseProseDate("12-Aug-2026").toISOString(), "2026-08-12T00:00:00.000Z");
  assert.equal(parseProseDate("12 August 2026 at 06:30").toISOString(), "2026-08-12T06:30:00.000Z");
  assert.equal(parseProseDate("12 Aug 2026 0630 hrs").toISOString(), "2026-08-12T06:30:00.000Z");
  assert.equal(parseProseDate("2026-08-12").toISOString(), "2026-08-12T00:00:00.000Z");
});

test("all-numeric dates are refused — DD/MM and MM/DD cannot be told apart", () => {
  assert.equal(parseProseDate("12/08/2026"), null);
  assert.equal(parseProseDate("08.12.2026"), null);
});

test("labelled start and end times are picked up from the body", () => {
  const fields = extractFieldsDeterministically({
    subject: "STS Nomination",
    bodyText: [
      "Type of operation: Ship to Ship",
      "Operation start: 12 Aug 2026 0600 hrs",
      "Operation end: 14 Aug 2026",
    ].join("\n"),
    options: OPTIONS,
  });

  assert.equal(fields.operationStartTime.toISOString(), "2026-08-12T06:00:00.000Z");
  assert.equal(fields.operationEndTime.toISOString(), "2026-08-14T00:00:00.000Z");
});

test("a laycan window starts the operation on the day it opens", () => {
  for (const line of [
    "Laycan: 10–14 August 2026", // en dash, as clients actually write it
    "Laycan: 10-14 Aug 2026",
    "Laydays: 10 to 14 August 2026",
  ]) {
    const fields = extractFieldsDeterministically({
      subject: "STS Nomination",
      bodyText: line,
      options: OPTIONS,
    });

    assert.equal(
      fields.operationStartTime.toISOString(),
      "2026-08-10T00:00:00.000Z",
      `expected the window to open on the 10th for "${line}"`
    );
    assert.equal(
      fields.operationEndTime,
      null,
      "the closing day is a cancelling date, not a completion time"
    );
  }
});

test("an explicit start line beats a laycan window", () => {
  const fields = extractFieldsDeterministically({
    subject: "",
    bodyText: "Laycan: 10-14 Aug 2026\nOperation start: 11 Aug 2026 0600 hrs",
    options: OPTIONS,
  });

  assert.equal(fields.operationStartTime.toISOString(), "2026-08-11T06:00:00.000Z");
});

test("an end at or before the start is dropped, the start is kept", () => {
  const fields = sanitizeExtractedFields(
    { operationStartTime: "2026-08-14T00:00", operationEndTime: "2026-08-12T00:00" },
    OPTIONS
  );

  assert.equal(fields.operationStartTime.toISOString(), "2026-08-14T00:00:00.000Z");
  assert.equal(fields.operationEndTime, null, "an end before the start is a misread");
});

test("model dates that are not ISO are discarded", () => {
  const fields = sanitizeExtractedFields(
    { operationStartTime: "next Tuesday", operationEndTime: "12/08/2026" },
    OPTIONS
  );

  assert.equal(fields.operationStartTime, null);
  assert.equal(fields.operationEndTime, null);
});

test("sanitizing its own output leaves the dates untouched", () => {
  // The route re-validates the merged result, so Dates must survive a second pass.
  const once = sanitizeExtractedFields({ operationStartTime: "2026-08-12T06:00" }, OPTIONS);
  const twice = sanitizeExtractedFields(once, OPTIONS);

  assert.equal(twice.operationStartTime.toISOString(), "2026-08-12T06:00:00.000Z");
});

/* =====================
   SENDER ADDRESS
====================== */

test("the sender address is pulled out of a From header", () => {
  assert.equal(senderEmailAddress("Ops Desk <ops@client.com>"), "ops@client.com");
  assert.equal(senderEmailAddress("ops@client.com"), "ops@client.com");
  assert.equal(senderEmailAddress('"Chartering, Ops" <Ops@Client.COM>'), "ops@client.com");
});

test("a header without a usable address yields null", () => {
  for (const value of ["", "Ops Desk", "<not-an-address>", null, undefined]) {
    assert.equal(senderEmailAddress(value), null, `expected null for ${JSON.stringify(value)}`);
  }
});
