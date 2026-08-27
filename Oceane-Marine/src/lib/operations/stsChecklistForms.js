/**
 * STS checklist form registry — shared by the STS Checklist page (client) and the
 * "send links to mooring master" API route (server) so the two can't drift apart.
 *
 * External STS form app: `{base}/{formNo}` with optional `?operationRef=` and `mode=update`
 * (see the `operations-sts-checklist` app).
 */

export const STS_CHECKLIST_EXTERNAL_BASE = (
  process.env.NEXT_PUBLIC_STS_CHECKLIST_FORMS_BASE_URL ??
  "https://oceane-marine-utyx.vercel.app"
).replace(/\/$/, "");

export function stsChecklistExternalUrl(formNo, operationRef, options) {
  const path = `${STS_CHECKLIST_EXTERNAL_BASE}/${encodeURIComponent(formNo)}`;
  const ref = operationRef?.trim();
  if (!ref) {
    return path;
  }
  const params = new URLSearchParams();
  params.set("operationRef", ref);
  if (options?.mode === "update") {
    params.set("mode", "update");
  }
  return `${path}?${params.toString()}`;
}

export const STS_CHECKLIST_FORMS = [
  { formNo: "OPS-OFD-001", title: "Checklist 1 - Before Operation Commence", apiPath: "ops-ofd-001" },
  { formNo: "OPS-OFD-001A", title: "Ship's Standard Questionnaire", apiPath: "ops-ofd-001a" },
  { formNo: "OPS-OFD-002", title: "Checklist 2 - Before Run In & Mooring", apiPath: "ops-ofd-002" },
  { formNo: "OPS-OFD-003", title: "Checklist 3A & 3B - Before Cargo Transfer", apiPath: "ops-ofd-003" },
  { formNo: "OPS-OFD-004", title: "Checklist 4A-F - Pre Transfer Conference", apiPath: "ops-ofd-004" },
  { formNo: "OPS-OFD-005", title: "Checklist 5A-C – After Connection Checks till Disconnection", apiPath: "ops-ofd-005" },
  { formNo: "OPS-OFD-005B", title: "Checklist 6A & B – Checks Before & After Disconnection", apiPath: "ops-ofd-005b" },
  { formNo: "OPS-OFD-005C", title: "Checklist 7 - Pre Transfer Conference Alongside a Terminal", apiPath: "ops-ofd-005c" },
  { formNo: "OPS-OFD-005D", title: "Declaration for STS operations (At port & Terminal)", apiPath: "ops-ofd-005d" },
  { formNo: "OPS-OFD-005E", title: "Declaration Of STS At Sea", apiPath: "declaration-of-sea" },
  { formNo: "OPS-OFD-028", title: "Personnel Transfer Basket Checklist", apiPath: "ops-ofd-028" },
  { formNo: "OPS-OFD-009", title: "Mooring Master's Job Report", apiPath: "ops-ofd-009" },
  { formNo: "OPS-OFD-011", title: "STS Superintendent Standing Order", apiPath: "ops-ofd-011" },
  { formNo: "OPS-OFD-014", title: "STS Equipment Checklist", apiPath: "ops-ofd-014" },
  { formNo: "OPS-OFD-015", title: "Hourly Checks on Discharged and Received Quantities", apiPath: "ops-ofd-015" },
  { formNo: "OPS-OFD-018", title: "Timesheet", apiPath: "ops-ofd-018" },
  { formNo: "OPS-OFD-020", title: "Master's Feedback Form", apiPath: "ops-ofd-020" },
  { formNo: "OPS-OFD-023", title: "Record of Work Hours (Rest Hours CKL)", apiPath: "ops-ofd-023" },
  { formNo: "OPS-OFD-029", title: "Mooring Master Expense Sheet", apiPath: "ops-ofd-029" },
  {
    formNo: "NEAR-MISS",
    title: "Near Miss Report",
    apiPath: null,
    directUrl: "https://oceane-marine-fgbs.vercel.app/forms/near-miss",
  },
];

/**
 * Forms sent to the mooring master in the bulk "send checklist links" email.
 * Excludes OPS-OFD-001A and OPS-OFD-005D, which are shared individually via their own Copy Link buttons.
 */
export const STS_CHECKLIST_SHARED_FORM_NOS = [
  "OPS-OFD-001",
  "OPS-OFD-002",
  "OPS-OFD-003",
  "OPS-OFD-004",
  "OPS-OFD-005",
  "OPS-OFD-005B",
  "OPS-OFD-005C",
  "OPS-OFD-005E",
  "OPS-OFD-009",
  "OPS-OFD-011",
  "OPS-OFD-014",
  "OPS-OFD-015",
  "OPS-OFD-018",
  "OPS-OFD-020",
  "OPS-OFD-023",
  "OPS-OFD-028",
  "OPS-OFD-029",
  "NEAR-MISS",
];

/**
 * Rows ({ code, name, url }) for the shared forms, resolved against an operation reference.
 * A form with a fixed `directUrl` (e.g. Near Miss) is not operation-scoped, so that URL is
 * used as-is rather than building one against the STS checklist forms app.
 */
export function buildStsChecklistLinkRows(operationRef) {
  return STS_CHECKLIST_SHARED_FORM_NOS.map((formNo) => {
    const form = STS_CHECKLIST_FORMS.find((f) => f.formNo === formNo);
    if (!form) return null;
    return {
      code: formNo,
      name: form.title,
      url: form.directUrl || stsChecklistExternalUrl(formNo, operationRef),
    };
  }).filter(Boolean);
}
