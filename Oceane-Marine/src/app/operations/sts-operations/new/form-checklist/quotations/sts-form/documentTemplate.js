/**
 * Generates print-friendly HTML for OPS-OFD-030 and OPS-OFD-030B quotation forms.
 * First page matches the provided PDF layout; all components are dynamic from form data.
 */

/** Served from `public/image/image.png` (Puppeteer PDF uses `public` as base URL). */
import { DOCUMENT_LOGO_PUBLIC_SRC } from "@/lib/brand/documentLogo";

const PDF_COVER_LOGO_SRC = DOCUMENT_LOGO_PUBLIC_SRC;

function fmtDate(d) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return x.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(s) {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function val(d, key, fallback = "") {
  const v = d[key];
  return v != null && String(v).trim() !== "" ? String(v).trim() : fallback;
}

/** Treat common mistaken empty placeholders saved from forms as missing */
function isNaLikeLocation(s) {
  const t = String(s).trim().toLowerCase();
  return t === "na" || t === "n/a" || t === "n.a.";
}

/**
 * Paragraph "… operate in this location ___": use dedicated base text if set,
 * otherwise the Cost of Operation location (users often fill only that field).
 */
function resolveBaseInfoLocationDisplay(d, emptyPlaceholder) {
  const primary = val(d, "baseInfoLocation");
  if (primary && !isNaLikeLocation(primary)) return primary;
  const loc = val(d, "location");
  if (loc && !isNaLikeLocation(loc)) return loc;
  return emptyPlaceholder;
}

/** Service overview / regional text: field value, else main operation location, else PDF default */
function resolveServiceOverviewField(d, key, pdfDefault) {
  const v = val(d, key);
  if (v && !isNaLikeLocation(v)) return v;
  const loc = val(d, "location");
  if (loc && !isNaLikeLocation(loc)) return loc;
  return pdfDefault;
}

/** All quotation types: manual text signature in PDF (no image upload). */
function buildAcceptanceSignatureBodyHtml(d) {
  const textSig = val(d, "acceptanceSignatureText");
  if (textSig) {
    return `<div class="signature-line-area signature-line-area--typed"><span class="acceptance-signature-text">${escapeHtml(textSig)}</span></div>`;
  }
  return `<div class="signature-line-area"></div>`;
}

const STYLES = `
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; color: #222; max-width: 210mm; margin: 0 auto; padding: 12mm; }
  /* Oceane quotation cover template – first page; height fits within PDF content area (A4 minus header/footer margins) */
  .cover-template-page { min-height: 257mm; box-sizing: border-box; position: relative; background: #e5e7eb; padding: 0; margin: -12mm -12mm 0 -12mm; padding: 12mm; }
  .cover-template-logo-band { position: absolute; top: 0; left: 0; right: 0; z-index: 2; background: #f2f2f2; padding: 14px 16px 18px 16px; min-height: 72px; }
  .cover-template-logo-band .cover-template-logo-img { display: block; height: 52px; width: auto; object-fit: contain; object-position: left center; }
  .cover-template-page .cover-template-blue-block { position: absolute; left: 24px; top: 175px; right: 0; bottom: 0; max-width: 78%; background: #1e3a5f; border-radius: 0 120px 120px 0; padding: 24px 28px 24px 80px; box-sizing: border-box; }
  .cover-template-page .cover-template-title { font-family: Arial, sans-serif; font-size: 20pt; font-weight: bold; color: #e8952e; letter-spacing: 0.02em; margin: 0 0 12px 0; line-height: 1.2; text-align: center; }
  .cover-template-page .cover-template-divider { height: 2px; background: rgba(255,255,255,0.9); margin: 10px 0 14px 0; }
  .cover-template-page .cover-template-client-box { border: 2px dashed rgba(255,255,255,0.9); padding: 10px 12px; margin-bottom: 12px; }
  .cover-template-page .cover-template-client-box p { margin: 4px 0; font-size: 11pt; }
  .cover-template-page .cover-template-client-box .label { color: #e8952e; font-weight: bold; }
  .cover-template-page .cover-template-client-box .value { color: #fff; }
  .cover-template-page .cover-template-company-box { border: 2px dashed rgba(255,255,255,0.9); padding: 10px 12px; }
  .cover-template-page .cover-template-company-box .company-name { color: #e8952e; font-weight: bold; font-size: 12pt; margin-bottom: 6px; }
  .cover-template-page .cover-template-company-box p { margin: 3px 0; color: #fff; font-size: 11pt; }
  .page-break { page-break-after: always; }
  .cover-page { min-height: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-top: 8mm; padding-bottom: 8mm; }
  .cover-page .form-no { font-size: 10pt; color: #333; margin-bottom: 10px; }
  .cover-page .meta { margin-bottom: 14px; }
  .cover-page .meta p { margin: 2px 0; font-size: 11pt; }
  .cover-page .main-title { font-size: 18pt; font-weight: bold; text-align: center; margin: 16px 0 12px; letter-spacing: 0.02em; }
  .cover-page .company-block { margin-top: 14px; font-size: 11pt; }
  .cover-page .company-block p { margin: 2px 0; }
  @media print {
    .cover-template-page { margin: 0; padding: 10mm; min-height: 257mm; }
    .cover-template-logo-band { padding: 12px 14px 14px 14px; min-height: 64px; }
    .cover-template-logo-band .cover-template-logo-img { height: 46px; }
    .cover-template-page .cover-template-blue-block { left: 20px; top: 155px; max-width: 78%; padding-left: 70px; padding-top: 20px; padding-bottom: 20px; }
  }
  h1 { font-size: 14pt; text-align: center; margin: 8px 0; }
  h2 { font-size: 12pt; margin: 8px 0 4px; border-bottom: 1px solid #333; padding-bottom: 2px; }
  .meta p { margin: 2px 0; }
  .form-no { font-size: 9pt; color: #555; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td, th { border: 1px solid #333; padding: 5px 6px; text-align: left; font-size: 10.5pt; }
  th { background: #f0f0f0; font-weight: bold; }
  .signature-block { margin-top: 14px; }
  .signature-block p { margin: 3px 0; }
  /* Writable signature / stamp space for PDF (Puppeteer print) */
  .signature-line-area {
    border-bottom: 1.5pt solid #111;
    min-height: 26mm;
    margin: 6px 0 12px 0;
    width: 100%;
    max-width: 160mm;
    box-sizing: border-box;
  }
  .signature-stamp-box {
    border: 1pt dashed #333;
    min-height: 32mm;
    margin: 8px 0 14px 0;
    width: 100%;
    max-width: 85mm;
    box-sizing: border-box;
    background: #fafafa;
  }
  .signature-date-line {
    border-bottom: 1pt solid #111;
    min-height: 10mm;
    margin: 4px 0 8px 0;
    max-width: 75mm;
    box-sizing: border-box;
  }
  .signature-line-area--typed {
    display: flex;
    align-items: flex-end;
    padding-bottom: 4px;
  }
  .acceptance-signature-text {
    font-family: "Segoe Script", "Brush Script MT", "Apple Chancery", cursive;
    font-size: 17pt;
    color: #111;
  }
  .confidential { font-size: 9pt; margin: 8px 0; padding: 8px; border: 1px solid #666; background: #fafafa; }
  .section-page { page-break-before: always; min-height: 0; }
  .section-page:first-of-type { page-break-before: avoid; }
  .section-content { margin-bottom: 0.5em; }
  .section-content p { margin: 5px 0; line-height: 1.4; }
  .doc-page { page-break-after: always; page-break-inside: avoid; padding: 0 0 8px 0; }
  .doc-page .page-form-no { font-size: 9pt; color: #555; margin-bottom: 8px; }
  .doc-page h2 { font-size: 12pt; margin: 10px 0 6px; border-bottom: 1px solid #333; padding-bottom: 2px; }
  .doc-page h2:first-child { margin-top: 0; }
  .doc-page .gap-sm { margin-bottom: 6px; }
  .doc-page .gap-md { margin-bottom: 10px; }
  .doc-page .gap-lg { margin-bottom: 14px; }
  .doc-page ul { margin: 6px 0 6px 20px; padding: 0; }
  .doc-page li { margin: 3px 0; }
  .doc-page .cost-list { margin: 8px 0; }
  .doc-page .cost-list p { margin: 4px 0; }
  /* Page size for print; header/footer are added by Puppeteer so no fixed elements in body */
  @page { size: A4; }
  @media print {
    body { padding: 10mm; padding-top: 0; padding-bottom: 0; }
    .cover-page { min-height: 0; padding-top: 6mm; padding-bottom: 6mm; page-break-after: always; }
    .page-break { page-break-after: always; }
    .section-page { page-break-before: always; }
    .section-page:first-of-type { page-break-before: avoid; }
    .doc-page { page-break-after: always; page-break-inside: avoid; }
  }
`;

/** Build first-page header line: Form No + Issue Date (dynamic from form) */
function coverFormNoLine(d, defaultFormNo) {
  const formNo = val(d, "formNo") || defaultFormNo;
  const issueStr = fmtDate(d.issueDate);
  const hasIssueInFormNo = formNo.toLowerCase().includes("issue date");
  const out = issueStr && !hasIssueInFormNo ? formNo + " / Issue Date: " + issueStr : formNo;
  return escapeHtml(out);
}

/** Raw form-no line for Puppeteer PDF footer (no HTML escape). */
export function getFormNoLineForPdf(d, defaultFormNo) {
  const formNo = val(d, "formNo") || defaultFormNo;
  const issueStr = fmtDate(d.issueDate);
  const hasIssueInFormNo = formNo.toLowerCase().includes("issue date");
  return issueStr && !hasIssueInFormNo ? formNo + " / Issue Date: " + issueStr : formNo;
}

/** First page (cover) – Oceane template: logo top-left, dark blue curved block, client/company dashed boxes, footer */
function buildCoverPage(d, options) {
  const { mainTitle, showConfidential = false } = options;
  const formNoLine = coverFormNoLine(d, options.defaultFormNo);
  const clientName = val(d, "clientName", "");
  const attn = val(d, "attn", "");
  const proposalDateStr = fmtDate(d.proposalDate) || "";
  const projectName = val(d, "projectName", "");

  const clientDisplay = clientName || "Client Name.";
  const attnDisplay = attn || "Client Name.";
  const proposalDisplay = proposalDateStr || "Enter Date";

  return `
  <div class="cover-template-page">
    <div class="cover-template-logo-band">
      <img src="${PDF_COVER_LOGO_SRC}" alt="Helios" class="cover-template-logo-img" />
    </div>
    <div class="cover-template-blue-block">
      <div class="cover-template-title">${mainTitle}</div>
      <div class="cover-template-divider"></div>
      <div class="cover-template-client-box">
        <p><span class="label">Client Name:</span> <span class="value">${escapeHtml(clientDisplay)}</span></p>
        <p><span class="label">Attn:</span> <span class="value">${escapeHtml(attnDisplay)}</span></p>
        <p><span class="label">Proposal Date:</span> <span class="value">${escapeHtml(proposalDisplay)}</span></p>
        ${projectName ? `<p><span class="label">Project Name:</span> <span class="value">${escapeHtml(projectName)}</span></p>` : ""}
      </div>
      <div class="cover-template-company-box">
        <div class="company-name">Oceane Fenders DMCC</div>
        <p>Part of Oceane Group of Companies</p>
        <p>1201, Fortune Tower, Cluster C, JLT</p>
        <p>Dubai, United Arab Emirates</p>
      </div>
      ${showConfidential ? `<div class="confidential" style="margin-top:14px;padding:8px;border:1px solid rgba(255,255,255,0.5);font-size:9pt;color:rgba(255,255,255,0.9);">This document, including all attachments and the information contained within, is confidential and the intellectual property of Oceane Fenders DMCC a subsidiary of the Oceane Group. It may not be shared, duplicated, distributed, or used for any purpose other than intended, without prior written approval.</div>` : ""}
    </div>
  </div>
  <div class="page-break"></div>
`;
}

/** OPS-OFD-030: First page (cover) – same layout as provided; dynamic components */
function coverPage030(d) {
  return buildCoverPage(d, {
    defaultFormNo: "Form No. OPS-OFD-30 / Rev 1.1 / Issue Date: 20 Aug 2023",
    mainTitle: "STS PROPOSAL &amp;<br/>QUOTATION",
    showConfidential: false,
  });
}

/** OPS-OFD-030B: First page (cover) – same layout as provided; dynamic components */
function coverPage030B(d) {
  return buildCoverPage(d, {
    defaultFormNo: "OPS-OFD-030B",
    mainTitle: "STS Advisor Quotation",
    showConfidential: true,
  });
}

const COMPANY_HEADER = `
  <p><strong>Oceane Fenders DMCC</strong></p>
  <p>1201, Fortune Tower, Cluster C, JLT</p>
  <p>Dubai, United Arab Emirates</p>
  <p>Tel: +971(04) 8347310 | Email: operations@oceanemarine.com</p>
`;

/** Form no line for inner pages (OPS-OFD-030) */
function pageFormNo030(d) {
  const formNoRaw = val(d, "formNo") || "Form No. OPS-OFD-30 / Rev 1.2 / Issue Date: 20 Aug 2023";
  const issueStr = fmtDate(d.issueDate);
  const formNo = issueStr && !formNoRaw.toLowerCase().includes("issue date") ? formNoRaw + " / Issue Date: " + issueStr : formNoRaw;
  return escapeHtml(formNo);
}

export function buildDocumentHtml030(data) {
  const d = data || {};
  const formNo = pageFormNo030(d);
  const loc = val(d, "location");
  const locationDisplay = loc && !isNaLikeLocation(loc) ? loc : "Select the location";
  const baseInfo = resolveBaseInfoLocationDisplay(d, "Select the location");
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>STS PROPOSAL &amp; QUOTATION - ${escapeHtml(val(d, "clientName", "Quotation"))}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${coverPage030(d)}

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <div class="section-content gap-lg">
      <p>Further to your recent enquiry, please find herewith our quotation for your proposed STS operation.</p>
      <p>We will provide all the equipment necessary to support your STS transfer operation and can confirm that all our operations are conducted in line with the latest OCIMF Ship to Ship Transfer Guide (Petroleum).</p>
      <p>Please feel free to call us any time, for further assistance or clarification.</p>
      <p>We look forward to being of service.</p>
    </div>
    <div class="section-content gap-md">
      <p>Yours sincerely</p>
      <p>Capt. Jagdeep Singh Sodhi<br/>Ops - Team<br/>Oceane Fenders DMCC<br/>For, and on behalf of Oceane Group of Companies</p>
    </div>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>PROPOSAL</h2>
    <div class="section-content gap-md">
      <p>To supply the services for your STS operation which includes Fenders, all fender mooring equipment, cargo hoses, a support craft to rig/unrig the fenders together with the services of one of our STS Superintendent who will advise during the berthing and unberthing of the vessels and supervise the transfer.</p>
      <p>Our service will include all costs in connection with the berthing &amp; unberthing and transfer of the cargo. Any other costs for owners' purposes such as agency fees will not be in our account. We will make all the local arrangements connected with the lighting.</p>
    </div>
    <h2>COST OF OPERATION</h2>
    <table class="gap-md">
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Job Ref #</td><td>${escapeHtml(val(d, "jobRef", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Discharging ship(s)</td><td>${escapeHtml(val(d, "dischargingShip", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Receiving ship(s)</td><td>${escapeHtml(val(d, "receivingShip", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Date</td><td>${escapeHtml(fmtDate(d.operationDate) || "Click or tap to enter a date.")}</td></tr>
      <tr><td>Location</td><td>${escapeHtml(locationDisplay)}</td></tr>
      <tr><td>Cargo</td><td>${escapeHtml(val(d, "cargo", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Quantity</td><td>${escapeHtml(val(d, "quantity", "Click or tap here to enter text."))} ${escapeHtml(val(d, "quantityUnit", "BBLS"))}</td></tr>
      <tr><td>Lump sum</td><td>${escapeHtml(val(d, "lumpSum", "Click or tap here to enter text."))} USD</td></tr>
      <tr><td>Thereafter</td><td>${escapeHtml(val(d, "thereafter", "Click or tap here to enter text."))} USD Per/ Hour</td></tr>
      <tr><td>Free time</td><td>${escapeHtml(val(d, "freeTime", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Availability</td><td>${escapeHtml(val(d, "availability", "Click or tap here to enter text."))}</td></tr>
      <tr><td>Payment terms</td><td>${escapeHtml(val(d, "paymentTerms", "Click or tap here to enter text."))}</td></tr>
    </table>
    <h2>NOMINATED AS STS PROVIDERS</h2>
    <p class="gap-sm">Upon nominating OCEANE FENDERS DMCC as STS Providers, please provide the following information:</p>
    <ul class="gap-md">
      <li>Discharging and receiving vessel Q88</li>
      <li>Cargo to be transferred and quantity.</li>
    </ul>
    <h2>BASE INFORMATION</h2>
    <p>Full details of the STS Equipment to be used on this operation, the rendezvous co-ordinates, and any additional requirements to operate in this location ${escapeHtml(baseInfo)}.</p>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>STS EQUIPMENT</h2>
    <table class="gap-md">
      <tr><th>Item</th><th>Details</th></tr>
      <tr><td>Primary Fenders</td><td>${escapeHtml(val(d, "primaryFenders", "xx Fenders of 3.3m x 6.5 m Yokohama Pneumatic fenders"))}</td></tr>
      <tr><td>Secondary Fenders</td><td>${escapeHtml(val(d, "secondaryFenders", "xx Fenders of 1.5m by 3.0m Yokohama Pneumatic Fenders"))}</td></tr>
      <tr><td>Fender Moorings</td><td>${escapeHtml(val(d, "fenderMoorings", "Fender moorings compatible with above fenders"))}</td></tr>
      <tr><td>Hoses</td><td>${escapeHtml(val(d, "hoses", "xx Hoses of 10&quot; dia. x 12m 150 ANSI Flanged Sea Flex hoses"))}</td></tr>
      <tr><td>Support Craft</td><td>${escapeHtml(val(d, "supportCraft", "Not Applicable"))}</td></tr>
      <tr><td>Personnel Transfer Basket</td><td>${escapeHtml(val(d, "personnelTransferBasket", "Choose an item."))}</td></tr>
    </table>
    <h2>STANDARD SHIP QUESTIONNAIRE</h2>
    <div class="section-content gap-md">
      <p>To protect your interests and the overall safety of the operation we require that the vessels must be physically suitable for the operation and have approval from the oil major. We will require our Ships Standards Questionnaire (OPS-OFD-001A) completed for each vessel involved and returned to us the completed and signed copy of the check list prior to commencement of STS operation.</p>
    </div>
    <h2>MOORING MASTER (POAC)</h2>
    <div class="section-content gap-md">
      <p>We will provide a Mooring Master (POAC – Person Overall Advisory Control) who will advise during the berthing and unberthing of the vessels and supervise the transfer. The Mooring Master will remain onboard for the duration of the operation. In order to comply with Standards of Training, Certification and Watchkeeping (STCW), where it is deemed necessary to provide an additional mooring master, we reserve the right to re-quote accordingly.</p>
      <p>The respective duties of the Mooring Master and the master of the vessels are set out in the Standard agreement. The Mooring Master is not directly responsible for cargo transfer but will nevertheless co-ordinate cargo operations to assist in ensuring that these are conducted in a safe and controlled manner. Our Mooring Master is certified to the standard required by MARPOL Chapter 8.</p>
      <p>Upon request from the company or the vessels involved in the operation(s), Oceane Fenders DMCC will supply details regarding the qualification and experience of the assigned Mooring Master (POAC). In order to comply with data protection legislation including the Data Protection Act 2018 and the General Data Protection Regulations (GDPR), Oceane Fenders DMCC will not share the details of assigned mooring master (POAC) with third parties.</p>
    </div>
    <h2>INDUSTRY REGULATIONS</h2>
    <p class="gap-sm">Oceane Fenders DMCC confirms that its operations are conducted in line with industry publications and guidelines, for the applicable cargo being transferred by STS, including but not limited to:</p>
    <p class="gap-sm">a) MARPOL 73/78/97 Annex 1 Ch.8; 'Prevention of pollution during transfer of oil cargo between oil tankers at sea'</p>
    <p class="gap-sm">b) IMO's "Manual of Oil Pollution", Section 1, Prevention, Chapter 6</p>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <p class="gap-sm">c) ICS and Oil Companies International Marine Forum (OCIMF) Ship-to-Ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases (First Edition 2013)</p>
    <p class="gap-md">d) SIGTTO</p>
    <h2>TERMS &amp; CONDITIONS</h2>
    <div class="section-content gap-md">
      <p>As per our standard indemnity terms and conditions, a copy of which can be provided on request, Operation can be carried out based on availability of Equipment, Mooring Master, etc. at the time of confirmation. Please confirm your acceptance of this quotation in writing, to include Your Reference No. if any and full style for invoicing purposes, if you wish to proceed with the operation.</p>
      <p>Oceane Group Standard Agreement for Ship to Ship Operation are provided with this quotation and form part of the contract between both parties, If, for whatever reason, the Ship-To-Ship Transfer Agreement is not signed prior to commencement of the proposed STS operation, the client by accepting the STS services nonetheless agrees by conduct to the provisions and conditions of such agreement as fully as if such Agreement had been signed.</p>
      <p>Please be advised that this quote is applicable for the above-mentioned date range. If the ships are delayed at previous ports or ETA's change resulting in the change of STS dates, then please note we may not be able to guarantee STS equipment availability hence please keep us closely advised if any date changes in the STS operation. Client to advise date range upon confirmation of operation to be narrowed/agreed 48 hours prior to commencement of operation. If there is any delay over 48 hours prior to the operation, we will charge you a standby rate for our STS Mooring Master of US $1500.00 per hour or pro rata. This offer is made on the basis of a normal commercial Ship to Ship Transfer operation. If in the event the operation is of a nonstandard, emergency or salvage nature special conditions apply and can be supplied on request.</p>
    </div>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>DAMAGES AND DELAYS</h2>
    <div class="section-content gap-md">
      <p>Whereby the special nature of the proposed operation unforeseen costs is incurred (e.g. extra equipment requirements, additional boat services, additional STS Superintendent(s) or personnel, diving inspections.) Then this will be for the Company's account as an Additional Cost, where arranged by Oceane Fenders DMCC.</p>
    </div>
    <h2>OIL SPILLS AND POLLUTION</h2>
    <div class="section-content gap-md">
      <p>In the event of oil spill or any form of pollution, or if the equipment supplied is used in Polluted waters and any part of the equipment has been contaminated, be it by chemicals, oil Products or other pollutants, the cost of any cleaning and disposal of pollutant required to Return the equipment to its former state will be solely for the Company's account. During such Process, any hire or purchase charges for replacement equipment (if required) shall be Additional Costs to the Company were arranged by Oceane Fenders DMCC.</p>
    </div>
    <h2>CANCELLATION OF OPERATIONS</h2>
    <div class="section-content gap-md">
      <p>Should the STS operation be cancelled (or moved to an alternative location) less than 48 hours prior to the original date of commencement, we reserve the right to charge a cancellation fee. Such a fee will represent only actual costs incurred- e.g. STS Mooring Master (expenses and flight) STS equipment mobilization etc. We will of course ensure all costs are kept to a minimum.</p>
    </div>
    <h2>EMERGENCY PLAN</h2>
    <div class="section-content gap-md">
      <p>In the event of an incident or emergency, if you require us to follow your procedures, please forward a copy of your emergency plan and contact details at a suitable time prior to commencement of operation.</p>
    </div>
    <p class="gap-lg">Please sign below and return as acceptance of our quotation:</p>
    <div class="signature-block">
      <p>Client Name (Company): ${escapeHtml(val(d, "acceptanceClientName", "Click or tap here to enter text."))}</p>
      <p>Person Incharge: ${escapeHtml(val(d, "personInCharge", "Click or tap here to enter text."))}</p>
      <p style="margin-top:10px;margin-bottom:4px;"><strong>Signature:</strong></p>
      ${buildAcceptanceSignatureBodyHtml(d)}
      <p>Date: ${escapeHtml(fmtDate(d.acceptanceDate) || "Click or tap here to enter text.")}</p>
    </div>
  </div>
</body>
</html>
`;
}

/** Form no line for 030B inner pages */
function pageFormNo030B(d) {
  const formNoRaw = val(d, "formNo") || "OPS-OFD-030B";
  const issueStr = fmtDate(d.issueDate);
  const formNo = issueStr && !formNoRaw.toLowerCase().includes("issue date") ? formNoRaw + " / Issue Date: " + issueStr : formNoRaw;
  return escapeHtml(formNo);
}

export function buildDocumentHtml030B(data) {
  const d = data || {};
  const formNo = pageFormNo030B(d);
  const svcFrom = escapeHtml(resolveServiceOverviewField(d, "serviceOverviewFrom", "Fujairah"));
  const svcTo = escapeHtml(resolveServiceOverviewField(d, "serviceOverviewTo", "Iraq"));
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>STS Advisor Quotation - ${escapeHtml(val(d, "clientName", "Quotation"))}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${coverPage030B(d)}

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>Table of Contents</h2>
    <div class="section-content gap-sm">
      <p>1.1 Service Overview ......................................................................................................................................................... 2</p>
      <p>1.2 Personnel Availability ............................................................................................................................................... 3</p>
      <p>1.3 Ongoing Commitments &amp; Conflicts ..................................................................................................................... 3</p>
      <p>1.4 Regional Permits &amp; Notifications .......................................................................................................................... 3</p>
      <p>1.5 Cargo Documentation Disclaimer ....................................................................................................................... 4</p>
      <p>1.6 Confirmation Requirements for STS Operations ............................................................................................... 4</p>
      <p>1.7 Communication Protocol ...................................................................................................................................... 5</p>
      <p>1.8 Compliance with Industry Standards .................................................................................................................. 5</p>
      <p>1.9 Definitions and Interpretation ................................................................................................................................ 5</p>
      <p>2.0 POAC Service Charges ............................................................................................................................................... 5</p>
      <p>2.1 Important Notes ........................................................................................................................................................... 6</p>
      <p>2.2 Consultant Responsibilities ...................................................................................................................................... 6</p>
      <p>2.3 General Terms ............................................................................................................................................................... 6</p>
      <p>2.4 Acceptance ................................................................................................................................................................... 6</p>
    </div>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    ${COMPANY_HEADER}
    <h2>1.1 Service Overview</h2>
    <ul class="gap-md">
      <li>Our STS Advisor will board the designated vessel at a mutually agreed location—typically off ${svcFrom}—prior to sailing to the load port off ${svcTo}.</li>
      <li>The Advisor will monitor the entire STS operation, including vessel approach, maneuvering, mooring, cargo transfer (loading/unloading), and unmooring activities.</li>
      <li>A comprehensive operational report will be compiled, covering:
        <ul>
          <li>Operational location and prevailing weather conditions</li>
          <li>Communication protocols and pre-transfer toolbox meetings</li>
          <li>Mooring and Fendering arrangements</li>
          <li>Vetting of personnel transfers, ensuring compliance with safety standard.</li>
          <li>Detailed inspection and photographic documentation of STS equipment (fenders, hoses, moorings, etc.)</li>
          <li>Performance and safety during approach, mooring, cargo handling, and unmooring</li>
          <li>Assessment of POAC/Mooring Master, tug performance, crew transfers.</li>
          <li>Observations of any near misses, safety concerns, incidents, or emergency/oil spill response readiness</li>
        </ul>
      </li>
      <li>The Advisor will remain onboard until disembarkation at a mutually agreed post-operation location.</li>
    </ul>
    <h2>1.2 Personnel Availability</h2>
    <ul class="gap-md">
      <li>All services are subject to the availability of our STS Advisors.</li>
      <li>Once a tentative schedule is provided by the Company, we will confirm personnel allocation accordingly.</li>
      <li>In the event of changes to the estimated time of arrival (ETA), the Company is requested to notify us promptly. We cannot ensure availability if there is a deviation from the confirmed schedule, although we will make reasonable efforts to accommodate such changes.</li>
      <li>If our consultant is asked to remain on-site in anticipation of a subsequent operation, a daily standby rate plus applicable expenses will be charged to the Company.</li>
    </ul>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>1.3 Ongoing Commitments &amp; Conflicts</h2>
    <p class="gap-md">Should we have other active commitments that may impact on the proposed service schedule, the Company will be informed prior to any contractual engagement.</p>
    <h2>1.4 Regional Permits &amp; Notifications</h2>
    <p class="gap-md">For operations in ${svcTo}, any permits, approvals, or regulatory notifications required by local authorities must be arranged directly by the Company, in line with regional compliance requirements. All related expenses will be borne by the Company.</p>
    <h2>1.5 Cargo Documentation Disclaimer</h2>
    <p class="gap-md">Please note that Oceane does not provide cargo surveying services. Any cargo documentation duties must be handled by the Vessel's Master, nominated cargo surveyors, or assigned agents.</p>
    <h2>1.6 Confirmation Requirements for STS Operations</h2>
    <p class="gap-sm">Once the operation schedule is finalized, please send the following details to operations@oceanemarine.com at your earliest convenience:</p>
    <ul class="gap-md">
      <li>A formal confirmation that Oceane Fenders DMCC is appointed to deliver POAC services, in accordance with the terms outlined in this Quotation.</li>
      <li>A declaration confirming that crew members onboard all participating vessels are free of COVID-19 symptoms and that any recently embarked personnel have completed mandatory quarantine. The Vessel Master is requested to provide evidence of this before STS clearance and mobilisation of our personnel.</li>
      <li>Notification of the Laycan window, to be shared at least 72 hours prior to the planned operation.</li>
      <li>Vessel names and Q88 forms for both discharging and receiving ships.</li>
      <li>Mooring plan and general arrangement for each vessel involved.</li>
      <li>For each vessel: Ownership details; Capability specifications; Flag state; STS-related equipment and condition summary</li>
    </ul>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <ul class="gap-md">
      <li>P&amp;I Club information</li>
      <li>Current location</li>
      <li>Information on cargo to be transferred: Type and estimated quantity; Temperature sensitivity (to verify STS hose compatibility); Details on any auxiliary cargo/products and quantities.</li>
      <li>Origin and shipper of the cargo.</li>
      <li>Destination as stated on the Bill of Lading (BOL).</li>
      <li>Estimated date of the STS transfer operation.</li>
      <li>Contact information for appointed agents and surveyors.</li>
      <li>List of any third parties intending to be present during the STS transfer.</li>
      <li>A clear description of the consultant support or services being requested.</li>
    </ul>
    <h2>1.7 Communication Protocol</h2>
    <p class="gap-sm">Acceptable methods of communication between the parties include (but are not limited to):</p>
    <ul class="gap-sm">
      <li>Telephone</li>
      <li>Email</li>
      <li>WhatsApp</li>
    </ul>
    <p class="gap-md">Please note: Any key operational information communicated via WhatsApp should be followed up and confirmed via email to maintain formal documentation.</p>
    <h2>1.8 Compliance with Industry Standards</h2>
    <p class="gap-sm">The appointed POAC's performance will be reviewed against relevant international standards and operational references, including but not limited to:</p>
    <ul class="gap-md">
      <li>MARPOL 73/78/97, Annex I, Chapter 8</li>
      <li>IMO Manual of Oil Pollution, Section 1, Chapter 6</li>
      <li>OCIMF/ICS Ship-to-Ship Transfer Guide for Petroleum, Chemicals, and Liquefied Gases (1st Ed. 2013)</li>
      <li>SIGTTO Guidelines</li>
    </ul>
    <h2>1.9 Definitions and Interpretation</h2>
    <p>Any terms or phrases defined in this Quotation shall, where applicable, carry the same meaning as defined in the associated Standard Terms, and vice versa.</p>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>2.0 POAC Service Charges</h2>
    <table class="gap-md">
      <tr><th>Item</th><th>Description</th><th>Cost</th></tr>
      <tr><td>Designated STS Advisor</td><td>${escapeHtml(val(d, "designatedAdvisor", "Capt Diptiman Guha"))}</td><td></td></tr>
      <tr><td>Daily Rate</td><td>Per calendar day (from departure to return home, inclusive)</td><td>${escapeHtml(val(d, "dailyRate", "USD 2,450.00"))}</td></tr>
      <tr><td>Management Fee</td><td>Per Operation</td><td>${escapeHtml(val(d, "managementFee", "USD 5,000.00"))}</td></tr>
      <tr><td>Flights &amp; Travel Expenses</td><td>Charged at actual cost-plus administrative handling</td><td>${escapeHtml(val(d, "flightsTravel", "Cost + 10% Admin Fee"))}</td></tr>
      <tr><td>Local Logistics (UAE)</td><td>Embarkation/disembarkation support, offshore access permissions, transport, support craft hire</td><td>${escapeHtml(val(d, "localLogistics", "Client's Account"))}</td></tr>
      <tr><td>Communication Charges</td><td>Satellite phone/internet use</td><td>${escapeHtml(val(d, "communicationCharges", "Approx. USD 50 per day, subject to location (additional charges may apply)"))}</td></tr>
    </table>
    <h2>2.1 Important Notes</h2>
    <ul class="gap-md">
      <li>The daily rate applies from the day the Advisor departs home until their return—both days inclusive.</li>
      <li>If the service is cancelled after the Advisor has left home, the full day rate remains chargeable until their return. All other associated costs will also be invoiced at cost plus 10%.</li>
    </ul>
    <h2>2.2 Consultant Responsibilities</h2>
    <div class="section-content gap-md">
      <p>Our company will assign a qualified STS Advisor to perform the tasks outlined under the agreed Service Description.</p>
      <p>The appointed representative holds certification aligned with POAC standards as defined under MARPOL Annex I, Chapter 8. However, please note that their role during the operation is limited to that of an Advisor. The Advisor will not undertake the full responsibilities or decision-making authority typically associated with a POAC or Superintendent role.</p>
      <p>Upon request from the Client or participating Vessels, we are happy to provide a summary of the Advisor's qualifications and professional background. In line with data protection regulations—including the Data Protection Act 2018 and GDPR—we are unable to share personal Consultant information with third parties without prior consent.</p>
    </div>
    <h2>2.3 General Terms</h2>
    <p class="gap-sm"><strong>Contractual Terms</strong><br/>Our General Terms &amp; Conditions, shared along with this Quotation, form a binding part of the agreement. Should the acceptance section below not be signed before services begin, the commencement of services will be considered as full acceptance of these terms.</p>
    <p class="gap-sm"><strong>Quotation Validity</strong><br/>This Quotation shall remain valid for 30 days from the date of issuance.</p>
    <p class="gap-md"><strong>Payment Terms</strong><br/>Invoices are due within 07 days from the date of invoice.</p>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>2.4 Acceptance</h2>
    <div class="section-content gap-md">
      <p>This Quotation, together with our Standard Terms and Conditions, any mutually agreed clauses, and relevant legal provisions, shall constitute the full basis of the contractual agreement between the Parties. A copy of our standard terms has been enclosed; please contact us should you not have received it.</p>
      <p>By signing and returning this document, or by instructing us to commence mobilization or related activities, the Company acknowledges and agrees to all terms set forth herein.</p>
      <p>Should you require any further clarification or additional information, please do not hesitate to contact us. We look forward to your confirmation.</p>
    </div>
    <p class="gap-md"><strong>The party agreed upon:</strong></p>
    <div class="signature-block">
      <p>Name: ${escapeHtml(val(d, "acceptanceName", "Click or tap here to enter text."))}</p>
      <p style="margin-top:8px;margin-bottom:4px;"><strong>Date:</strong></p>
      <div class="signature-date-line" title="Date"></div>
      <p>Address: ${escapeHtml(val(d, "acceptanceAddress", "_________________________________"))}</p>
      <p>Email: ${escapeHtml(val(d, "acceptanceEmail", "_________________________________"))}</p>
      <p>Telephone: ${escapeHtml(val(d, "acceptanceTelephone", "_________________________________"))}</p>
      <p>As authorized signatory for: ${escapeHtml(val(d, "authorizedSignatoryFor", "_________________________________"))}</p>
      <p style="margin-top:12px;margin-bottom:4px;"><strong>Signature:</strong></p>
      ${buildAcceptanceSignatureBodyHtml(d)}
      <p style="margin-top:10px;margin-bottom:4px;"><strong>Company stamp</strong> (if applicable)</p>
      <div class="signature-stamp-box" title="Company stamp"></div>
    </div>
    <div class="section-content gap-md" style="margin-top: 14px;">
      <p><strong>Company Acknowledgment</strong></p>
      <p>For, and on behalf of Oceane Group of Companies<br/>Capt. Jagdeep Singh Sodhi<br/>OPS-Team</p>
      <p>Date: ${escapeHtml(fmtDate(d.acceptanceDate030B) || "Click or tap to enter a date.")}</p>
    </div>
  </div>
</body>
</html>
`;
}

/** POAC (Person Overall Advisory Control) Quotation – third form type */
function coverPagePOAC(d) {
  return buildCoverPage(d, {
    defaultFormNo: "Form No. OPS-OFD-30A / Rev 1.2 / Issue Date: 20 Aug 2023",
    mainTitle: "POAC SERVICES PROPOSAL &amp;<br/>QUOTATION",
    showConfidential: false,
  });
}

export function buildDocumentHtmlPOAC(data) {
  const d = data || {};
  const formNo = escapeHtml(val(d, "formNo") || "POAC Quotation");
  const baseInfo = resolveBaseInfoLocationDisplay(d, "Select the location");
  const poacLoc = val(d, "location");
  const poacLocationDisplay = poacLoc && !isNaLikeLocation(poacLoc) ? poacLoc : "";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>POAC Quotation - ${escapeHtml(val(d, "clientName", "Quotation"))}</title>
  <style>${STYLES}</style>
</head>
<body>
  ${coverPagePOAC(d)}

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <div class="section-content gap-lg">
      <p>Further to your recent enquiry, please find herewith our quotation for POAC (Person Overall Advisory Control) services to support your STS transfer operation and can confirm that all our operations are conducted in line with the latest OCIMF Ship to Ship Transfer Guide (Petroleum).</p>
      <p>Please feel free to call us any time, for further assistance or clarification.</p>
      <p>We look forward to being of service.</p>
    </div>
    <div class="section-content gap-md">
      <p>Yours sincerely</p>
      <p>Capt. Jagdeep Singh Sodhi<br/>Ops - Team<br/>Oceane Fenders DMCC<br/>For, and on behalf of Oceane Group of Companies</p>
    </div>
    <p class="gap-lg" style="font-size: 9pt; color: #555;">Errors &amp; Omissions Excepted</p>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>PROPOSAL</h2>
    <div class="section-content gap-md">
      <p>To provide POAC services for your STS operation and advise during the berthing and unberthing of the vessels and supervise the cargo transfer. Primary /Secondary Fenders, cargo hoses, a support craft to rig/unrig the fenders together are provided by 03rd Party. Our service will include all costs in connection with the berthing &amp; unberthing and transfer of the cargo. Any other costs for owners' purposes such as agency fees will not be in our account.</p>
    </div>
    <h2>COST OF OPERATION</h2>
    <table class="gap-md">
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>Job Ref #</td><td>${escapeHtml(val(d, "jobRef", ""))}</td></tr>
      <tr><td>Discharging ship(s)</td><td>${escapeHtml(val(d, "dischargingShip", ""))}</td></tr>
      <tr><td>Receiving ship(s)</td><td>${escapeHtml(val(d, "receivingShip", ""))}</td></tr>
      <tr><td>Date</td><td>${escapeHtml(fmtDate(d.operationDate) || "")}</td></tr>
      <tr><td>Location</td><td>${escapeHtml(poacLocationDisplay)}</td></tr>
      <tr><td>Cargo</td><td>${escapeHtml(val(d, "cargo", ""))}</td></tr>
      <tr><td>Quantity</td><td>${escapeHtml(val(d, "quantity", ""))} ${escapeHtml(val(d, "quantityUnit", "Metric Tons"))}</td></tr>
      <tr><td>Day Rate</td><td>${escapeHtml(val(d, "dailyRate", ""))} USD</td></tr>
      <tr><td>Payment terms</td><td>${escapeHtml(val(d, "paymentTerms", ""))}</td></tr>
    </table>
    <p class="gap-sm"><strong>Note:</strong></p>
    <p class="gap-md">The day rate will apply from the day the POAC departs their hometown until the day they return, inclusive of both days. Any delays during travel, in either direction, will not be exempt from the day rate, and any additional costs incurred due to such delays will also be applicable.</p>
    <div class="cost-list gap-md">
      <p><strong>Flight &amp; Out of Pocket Expenses</strong><br/>${escapeHtml(val(d, "flightsTravel", "At Cost + 10%"))}</p>
      <p><strong>Coordination Fee</strong><br/>${escapeHtml(val(d, "managementFee", "USD 3500"))}</p>
      <p><strong>Cancellation</strong><br/>If the POAC service is cancelled or postponed after the POAC has departed from their hometown, the day rate and any ancillary costs will continue to apply until they return home.</p>
    </div>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>NOMINATED AS STS PROVIDERS</h2>
    <p class="gap-sm">Upon nominating OCEANE FENDERS DMCC as STS Providers, please provide the following information:</p>
    <ul class="gap-md">
      <li>Discharging and receiving vessel Q88</li>
      <li>Cargo to be transferred and quantity.</li>
    </ul>
    <h2>BASE INFORMATION</h2>
    <p>Full details of the STS Equipment to be used on this operation, the rendezvous co-ordinates, and any additional requirements to operate in this location ${escapeHtml(baseInfo)}.</p>
    <h2>03RD PARTY STS EQUIPMENT</h2>
    <table class="gap-md">
      <tr><th>Item</th><th>Details</th></tr>
      <tr><td>Primary Fenders</td><td>${escapeHtml(val(d, "primaryFenders", "4 Fenders of 3.3m x 6.5 m Yokohama Pneumatic fenders"))}</td></tr>
      <tr><td>Secondary Fenders</td><td>${escapeHtml(val(d, "secondaryFenders", "NA"))}</td></tr>
      <tr><td>Fender Moorings</td><td>${escapeHtml(val(d, "fenderMoorings", "Fender moorings compatible with the above fenders"))}</td></tr>
      <tr><td>Hoses</td><td>${escapeHtml(val(d, "hoses", "2 Hoses of 08&quot; dia. x 22m 150 ANSI Flanged Sea Flex hoses"))}</td></tr>
      <tr><td>Support Craft</td><td>${escapeHtml(val(d, "supportCraft", "Not Applicable"))}</td></tr>
      <tr><td>Personnel Transfer Basket</td><td>${escapeHtml(val(d, "personnelTransferBasket", "No"))}</td></tr>
    </table>
    <h2>STANDARD SHIP QUESTIONNAIRE</h2>
    <div class="section-content gap-md">
      <p>To protect your interests and the overall safety of the operation we require that the vessels must be physically suitable for the operation and have approval from the oil major. We will require our Ships Standards Questionnaire (OPS-OFD-001A) completed for each vessel involved and returned to us the completed and signed copy of the check list prior to commencement of STS operation.</p>
    </div>
    <h2>MOORING MASTER (POAC)</h2>
    <div class="section-content gap-md">
      <p>We will provide a certified Mooring Master (POAC) to advise during the berthing and unberthing of vessels and to supervise the transfer operation. The Mooring Master will remain onboard for the entire duration of the operation. In compliance with the Standards of Training, Certification, and Watchkeeping (STCW), if it becomes necessary to assign an additional Mooring Master, we reserve the right to re-quote accordingly.</p>
      <p>The respective duties of the Mooring Master and the vessel masters are detailed in the Standard Agreement. While the Mooring Master is not directly responsible for cargo transfer, they will coordinate cargo operations to help ensure that these are conducted safely and efficiently. Our Mooring Master is certified to meet the standards required by MARPOL Chapter 8.</p>
      <p>Upon request by the company or vessels involved in the operation, Oceane Fenders DMCC will provide details regarding the qualifications and experience of the assigned Mooring Master (POAC). However, to comply with data protection laws, including the Data Protection Act 2018 and the General Data Protection Regulation (GDPR), Oceane Fenders DMCC will not share personal details of the assigned Mooring Master with third parties.</p>
    </div>
    <h2>INDUSTRY REGULATIONS</h2>
    <p class="gap-sm">Oceane Fenders DMCC confirms that its operations are conducted in line with industry publications and guidelines for the applicable cargo being transferred by STS, including but not limited to:</p>
    <ul class="gap-md">
      <li>MARPOL 73/78/97 Annex 1 Ch.8; 'Prevention of pollution during transfer of oil cargo between oil tankers at sea'</li>
      <li>IMO's "Manual of Oil Pollution", Section 1, Prevention, Chapter 6</li>
      <li>ICS and Oil Companies International Marine Forum (OCIMF) Ship-to-Ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases (First Edition 2013)</li>
      <li>SIGTTO</li>
    </ul>
  </div>

  <div class="doc-page section-page">
    <div class="page-form-no">${formNo}</div>
    <h2>TERMS &amp; CONDITIONS</h2>
    <div class="section-content gap-md">
      <p>As per our standard indemnity terms and conditions (a copy of which can be provided upon request), operations are subject to the availability of equipment, Mooring Master, and other required resources at the time of confirmation.</p>
      <p>To proceed with the operation, please confirm your acceptance of this quotation in writing. Include your reference number (if applicable) and full invoicing details.</p>
      <p>The Oceane Group Standard Agreement for Ship-to-Ship Operations is provided with this quotation and forms an integral part of the contract between both parties. If, for any reason, the Ship-to-Ship Transfer Agreement is not signed prior to the commencement of the proposed operation, the client, by accepting the STS services, agrees by conduct to the terms and conditions of the agreement as though it had been signed.</p>
      <p>This quotation is valid for the specified date range. If delays occur at prior ports or ETAs change, resulting in revised STS dates, equipment availability cannot be guaranteed. Kindly keep us informed of any changes to the schedule. The client must confirm the date range and finalize details at least 48 hours prior to the commencement of operations. If delays exceed 48 hours before the operation begins, a standby charge for the STS Mooring Master will apply at US $1,500 per hour (pro rata).</p>
      <p>This offer assumes a standard commercial Ship-to-Ship Transfer operation. If the operation involves nonstandard, emergency, or salvage circumstances, special conditions will apply and can be provided upon request.</p>
    </div>
    <h2>DAMAGES AND DELAYS</h2>
    <div class="section-content gap-md">
      <p>In the event that the special nature of the proposed operation results in unforeseen costs (e.g., additional equipment requirements, extra boat services, additional STS Superintendents or personnel, diving inspections), such costs will be considered Additional Costs and will be charged to the Company's account, where arranged by Oceane Fenders DMCC.</p>
    </div>
    <h2>OIL SPILLS AND POLLUTION</h2>
    <div class="section-content gap-md">
      <p>In the event of oil spill or any form of pollution, or if the equipment supplied is used in Polluted waters and any part of the equipment has been contaminated, be it by chemicals, oil Products or other pollutants, the cost of any cleaning and disposal of pollutant required to Return the equipment to its former state will be solely for the Company's account. During such Process, any hire or purchase charges for replacement equipment (if required) shall be Additional Costs to the Company were arranged by Oceane Fenders DMCC.</p>
    </div>
    <h2>CANCELLATION OF OPERATIONS</h2>
    <div class="section-content gap-md">
      <p>Should the STS operation be cancelled (or moved to an alternative location) less than 48 hours prior to the original date of commencement, we reserve the right to charge a cancellation fee. Such a fee will represent only actual costs incurred- e.g. STS Mooring Master (expenses and flight) STS equipment mobilization etc. We will of course ensure all costs are kept to a minimum.</p>
    </div>
    <h2>EMERGENCY PLAN</h2>
    <div class="section-content gap-md">
      <p>In the event of an incident or emergency, if you require us to follow your procedures, please forward a copy of your emergency plan and contact details at a suitable time prior to commencement of operation.</p>
    </div>
    <p class="gap-lg">Please sign below and return as acceptance of our quotation:</p>
    <div class="signature-block">
      <p>Client Name (Company): ${escapeHtml(val(d, "acceptanceClientName", ""))}</p>
      <p>Person Incharge: ${escapeHtml(val(d, "personInCharge", ""))}</p>
      <p style="margin-top:10px;margin-bottom:4px;"><strong>Signature:</strong></p>
      ${buildAcceptanceSignatureBodyHtml(d)}
      <p>Date: ${escapeHtml(fmtDate(d.acceptanceDate) || "___________________________")}</p>
    </div>
  </div>
</body>
</html>
`;
}
