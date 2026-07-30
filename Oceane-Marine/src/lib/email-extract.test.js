import test from "node:test";
import assert from "node:assert/strict";

import {
  routeAttachments,
  resolveSlot,
  resolveVessel,
  matchOption,
  extractFieldsDeterministically,
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
    client: null,
    agent: null,
    quantity: "80000",
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
