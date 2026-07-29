/**
 * Generate a professional PDF of the Oceane Marine application overview.
 *   node scripts/generate-overview-pdf.mjs
 * Output: docs/Oceane-Marine-Overview.pdf
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "docs", "Oceane-Marine-Overview.pdf");

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1f2a37; font-size: 11.5px; line-height: 1.6; }
  .page-break { page-break-before: always; }

  /* Cover */
  .cover { height: 1020px; background: linear-gradient(160deg,#0b2740 0%,#0f3a5f 55%,#11507f 100%);
           color: #fff; display: flex; flex-direction: column; justify-content: center;
           padding: 0 70px; position: relative; }
  .cover .accent { width: 70px; height: 6px; background: #38bdf8; border-radius: 4px; margin-bottom: 34px; }
  .cover h1 { font-size: 44px; font-weight: 800; line-height: 1.15; letter-spacing: -0.5px; }
  .cover h2 { font-size: 19px; font-weight: 400; color: #9fd0ef; margin-top: 18px; }
  .cover .tag { margin-top: 46px; font-size: 12.5px; color: #cfe6f7; max-width: 560px; line-height: 1.7; }
  .cover .foot { position: absolute; bottom: 60px; left: 70px; font-size: 11px; color: #7fb4d8;
                 letter-spacing: 1px; text-transform: uppercase; }
  .cover .badges { margin-top: 40px; display: flex; gap: 10px; flex-wrap: wrap; }
  .cover .badge { background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.4);
                  color: #cfe9fb; padding: 7px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; }

  /* Content */
  .content { padding: 0 60px; }
  h2.section { font-size: 21px; color: #0f3a5f; font-weight: 800; margin: 34px 0 6px;
               padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  h2.section .num { color: #0ea5e9; margin-right: 10px; }
  h3 { font-size: 14px; color: #0b4a73; font-weight: 700; margin: 18px 0 6px; }
  p { margin: 7px 0; }
  ul { margin: 7px 0 7px 20px; }
  li { margin: 4px 0; }
  strong { color: #0b2740; }
  .lead { font-size: 12.5px; color: #334155; }

  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th { background: #0f3a5f; color: #fff; text-align: left; padding: 9px 12px; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e9ee; vertical-align: top; }
  tr:nth-child(even) td { background: #f6f9fc; }

  .keybox { background: #f0f7fc; border-left: 4px solid #0ea5e9; border-radius: 6px;
            padding: 12px 16px; margin: 12px 0; }
  .keybox .kt { font-weight: 700; color: #0b4a73; font-size: 11.5px; margin-bottom: 4px; }
  .keybox ul { margin: 4px 0 0 18px; }

  .why { background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin: 14px 0; }
  .why .kt { font-weight: 700; color: #b45309; margin-bottom: 3px; }

  .summary { background: #0f3a5f; color: #fff; border-radius: 10px; padding: 22px 26px; margin-top: 16px; }
  .summary h2 { color: #fff; border: none; }
  .summary ul { list-style: none; margin-left: 0; }
  .summary li { margin: 7px 0; padding-left: 26px; position: relative; }
  .summary li:before { content: "✓"; position: absolute; left: 0; color: #38bdf8; font-weight: 800; }
  .summary .punch { margin-top: 16px; font-size: 12.5px; color: #cfe9fb; font-style: italic; }
`;

const moduleRow = (m, p) => `<tr><td><strong>${m}</strong></td><td>${p}</td></tr>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>

<section class="cover">
  <div class="accent"></div>
  <h1>Oceane Marine</h1>
  <h2>Operations &amp; Compliance Management Platform</h2>
  <p class="tag">A single, secure platform for Ship-to-Ship (STS) transfer operations — unifying operations, equipment maintenance, safety &amp; compliance, and personnel certification.</p>
  <div class="badges">
    <span class="badge">Operations</span>
    <span class="badge">PMS</span>
    <span class="badge">QHSE</span>
    <span class="badge">HR</span>
    <span class="badge">SharePoint Sync</span>
  </div>
  <div class="foot">Application Overview &nbsp;•&nbsp; Confidential</div>
</section>

<div class="content">

  <h2 class="section"><span class="num">1</span>Introduction</h2>
  <p class="lead"><strong>Oceane Marine</strong> is a centralized web platform built for a <strong>Ship-to-Ship (STS) transfer operator</strong> — a company that manages the safe transfer of cargo (oil, chemicals, gas) between vessels at sea, along with the equipment, personnel, and compliance this demands.</p>
  <p>Running STS operations involves heavy documentation, strict international safety standards, expensive equipment, certified personnel, and approvals from major oil companies. Traditionally this is scattered across spreadsheets, emails, and folders. This platform brings everything into <strong>one secure system</strong>, organized into four core modules:</p>
  <table>
    <tr><th style="width:24%">Module</th><th>Purpose</th></tr>
    ${moduleRow("Operations", "Plan, document and execute STS transfer operations")}
    ${moduleRow("PMS — Planned Maintenance System", "Track and maintain marine equipment (fenders, hoses, gear)")}
    ${moduleRow("QHSE — Quality, Health, Safety, Environment", "Manage safety, compliance, audits and incident reporting")}
    ${moduleRow("HR", "Manage certificates, personnel qualifications and approvals")}
  </table>
  <p>In addition, a <strong>SharePoint Document Integration</strong> automatically brings the company's existing document archive into the platform, and an automated <strong>reminder system</strong> keeps the team ahead of every deadline.</p>

  <h2 class="section"><span class="num">2</span>How Operations Works</h2>
  <p>The <strong>Operations module</strong> is the heart of the platform — managing the full lifecycle of an STS transfer, from planning to documentation to completion.</p>
  <h3>The workflow</h3>
  <ul>
    <li><strong>Create an operation</strong> — vessel details, cargo type &amp; quantity, location, client, agent and the assigned <strong>Mooring Master / POAC</strong>. A unique operation reference number is auto-generated.</li>
    <li><strong>Check compatibility</strong> — the <strong>Compatibility Calculator</strong> uses vessel dimensions to calculate the <strong>fenders and hoses</strong> required for a safe transfer, by sea condition (calm / moderate / rough).</li>
    <li><strong>Complete forms &amp; checklists</strong> — STS Checklists, Joint Planning Operation (JPO), Inspection Checklists and Quotations, each following a <strong>Draft → Submitted → Approved</strong> workflow.</li>
    <li><strong>Generate official documents</strong> — professional, branded <strong>PDF/Word</strong> documents ready for clients and regulators.</li>
    <li><strong>Track every document</strong> — each operation tracks <strong>30+ document types</strong> so nothing is missed for compliance.</li>
  </ul>
  <div class="keybox"><div class="kt">Key points</div>
    <ul>
      <li><strong>Auto-save</strong> — every form continuously saves a draft, so work is never lost.</li>
      <li><strong>Smart location linking</strong> — selecting a location auto-loads its risk assessment &amp; planning documents.</li>
      <li><strong>One-click document generation</strong> — quotations &amp; checklists become formatted PDFs instantly.</li>
      <li><strong>Master data</strong> — reusable lists of cargo types, clients, agents, locations and mooring masters.</li>
      <li><strong>Automated follow-ups</strong> — reminder emails for outstanding STS documentation.</li>
    </ul>
  </div>

  <h2 class="section"><span class="num">3</span>What PMS Does — Planned Maintenance System</h2>
  <p>The company owns expensive, safety-critical marine equipment — <strong>fenders, hoses, lifting gear</strong> — that must be tracked, tested, and certified. The <strong>PMS module</strong> manages this equipment's entire lifecycle.</p>
  <h3>What it manages</h3>
  <ul>
    <li><strong>Equipment Inventory</strong> — a full register of <strong>Primary Equipment</strong> (unique serial code, manufacturer, purchase date, ownership, retirement schedule) and <strong>Accessories</strong>; every item's physical location is known (Office / Base / Bay).</li>
    <li><strong>Equipment Testing</strong> — schedules regular safety tests, records testers &amp; dates, and flags overdue items.</li>
    <li><strong>Warehouse Management</strong> — tracks equipment movement between locations (in-transit, from/to, stopover) with delivery documents.</li>
    <li><strong>Certifications</strong> — stores each item's manufacturing certificate and recurring test certificates as proof of compliance.</li>
  </ul>
  <div class="keybox"><div class="kt">Key points</div>
    <ul>
      <li><strong>Testing reminders</strong> — automatic emails <strong>30 days and 15 days</strong> before any equipment's next test date.</li>
      <li><strong>Overdue alerts</strong> — if equipment in transit passes its expected arrival date, the team is notified.</li>
      <li><strong>Full traceability</strong> — serial codes, test history and certificates create a complete audit trail.</li>
      <li><strong>Always know where equipment is</strong> — across offices, bases, bays, or in transit.</li>
    </ul>
  </div>
  <div class="why"><div class="kt">Business value</div>Equipment never misses a safety test, is never lost, and is always compliant — reducing risk and avoiding costly operational delays.</div>

  <div class="page-break"></div>
  <h2 class="section"><span class="num">4</span>Why QHSE Exists &amp; What It Is</h2>
  <p>STS transfers are high-risk operations governed by strict international regulations (ISM Code, MARPOL, OCIMF, ISO standards). Oil majors and port authorities require operators to <strong>prove</strong> they manage safety, quality and the environment properly.</p>
  <p>The <strong>QHSE module</strong> is the company's complete <strong>compliance and safety management system</strong> — providing the documentation and audit trail needed to operate legally and win business from major clients.</p>
  <h3>What it covers</h3>
  <ul>
    <li><strong>Controlled Document Register</strong> — a master library of policies &amp; procedures with version control.</li>
    <li><strong>Training &amp; Drills</strong> — annual training plans, quarterly drill schedules, and completion records.</li>
    <li><strong>Audit Forms &amp; Checklists</strong> — STS Base Audits, Transfer Audits, HSE Induction, New Base Setup and equipment readiness.</li>
    <li><strong>Near-Miss Reporting</strong> — staff report unsafe situations with root-cause analysis, plus <strong>automatic email alerts</strong> to the safety team.</li>
    <li><strong>Defects List</strong> — track defects from discovery to closure (with email notification on closure).</li>
    <li><strong>Management of Change (MOC)</strong> — a formal approval process for operational changes, with risk assessment.</li>
    <li><strong>Due Diligence / Subcontractor Audits</strong> — vetting of vendors and contractors (licenses, insurance, ISO certificates).</li>
    <li><strong>Audits &amp; Inspection Planner</strong> — a compliance calendar of all scheduled audits.</li>
    <li><strong>POAC Cross-Competency</strong> — performance evaluation matrix for the experts who oversee transfers.</li>
    <li><strong>Risk Assessments, Best Practices, KPIs &amp; Archive</strong> — continuous improvement and management reporting.</li>
  </ul>
  <div class="keybox"><div class="kt">Key points</div>
    <ul>
      <li><strong>Incident prevention</strong> — near-miss &amp; defect tracking with root-cause analysis prevents repeat accidents.</li>
      <li><strong>Audit-ready</strong> — every record is serial-numbered and version-controlled, aligned with ISO 9001 / 14001 / 45001.</li>
      <li><strong>Instant alerts</strong> — the safety team is notified immediately of near-misses and closed defects.</li>
      <li><strong>Win client trust</strong> — demonstrable safety records are essential to be approved by oil majors.</li>
    </ul>
  </div>
  <div class="why"><div class="kt">Why it was built</div>Without a structured QHSE system, the company cannot pass audits, satisfy oil-major requirements, or defend itself legally. QHSE turns compliance from scattered paperwork into a reliable, provable process.</div>

  <h2 class="section"><span class="num">5</span>What the HR Module Does</h2>
  <p>In an STS company, "HR" is less about payroll and more about the <strong>compliance of the company and its key people</strong> — the certificates, qualifications and clearances required to operate.</p>
  <h3>What it manages</h3>
  <ul>
    <li><strong>Statutory Certificates</strong> — the company's legal &amp; regulatory certificates (registrations, permits, insurance) with expiry tracking per location.</li>
    <li><strong>Oil Majors</strong> — the approval status with major oil companies (Shell, BP, Chevron, ADNOC, etc.) and all supporting due-diligence documents. Being "Approved" is essential to win their business.</li>
    <li><strong>POAC Matrix</strong> — a detailed qualification matrix for the senior experts who run transfers: passport, Master's certificate, dangerous-cargo endorsements, oil-spill &amp; simulator training, medical fitness and location visas — each with expiry dates and uploaded proof.</li>
    <li><strong>CID Clearance</strong> — security/background clearances required for port access, with expiry tracking.</li>
  </ul>
  <div class="keybox"><div class="kt">Key points</div>
    <ul>
      <li><strong>Expiry reminders</strong> — automatic emails before certificates expire (Statutory: 30 &amp; 15 days; CID: 5 days).</li>
      <li><strong>Personnel compliance</strong> — ensures only fully-certified, medically-fit, security-cleared people conduct transfers.</li>
      <li><strong>Document proof</strong> — every qualification has its supporting file attached.</li>
    </ul>
  </div>
  <div class="why"><div class="kt">Business value</div>Prevents the costly situation where an expired certificate or lapsed clearance forces operations to stop.</div>

  <div class="page-break"></div>
  <h2 class="section"><span class="num">6</span>SharePoint Document Integration</h2>
  <p>The company already stored years of documents (2021–2026) in <strong>Microsoft SharePoint</strong>. The platform now <strong>automatically syncs</strong> those documents into each module.</p>
  <ul>
    <li>A <strong>"Documents" section</strong> in each module shows the SharePoint files in a familiar <strong>folder-browser</strong>, mirroring the original structure.</li>
    <li>A <strong>one-click Sync</strong> pulls the latest files; files are stored securely with a fast database reference.</li>
    <li>An <strong>automatic daily sync</strong> keeps everything current — new files in SharePoint appear automatically.</li>
    <li>The integration is <strong>read-only and secure</strong>, via Microsoft's official, admin-approved connection.</li>
  </ul>
  <div class="keybox"><div class="kt">Key points</div>
    <ul>
      <li><strong>Automatic &amp; up-to-date</strong> — daily background sync, no manual effort.</li>
      <li><strong>Familiar structure</strong> — files organized exactly as in SharePoint, with download access.</li>
      <li><strong>Secure</strong> — read-only access through an admin-approved Microsoft connection.</li>
    </ul>
  </div>

  <h2 class="section"><span class="num">7</span>Platform-Wide Features</h2>
  <ul>
    <li><strong>Role-based access</strong> — every module supports <strong>Admin, Editor, Approver and Viewer</strong> roles, so each user sees and does only what their job requires.</li>
    <li><strong>Automated email reminders</strong> — the system proactively emails the right teams before deadlines (equipment tests, certificate expiries, documentation follow-ups).</li>
    <li><strong>Document generation</strong> — professional, branded PDF/Word documents on demand.</li>
    <li><strong>Audit trail</strong> — records are serial-numbered, versioned and timestamped for full traceability.</li>
    <li><strong>Secure &amp; reliable</strong> — authenticated access, background processing for heavy tasks, and self-healing services for high uptime.</li>
  </ul>

  <div class="summary">
    <h2 class="section" style="border:none;color:#fff;margin-top:0"><span class="num" style="color:#38bdf8">8</span>Summary</h2>
    <p style="color:#cfe9fb;margin-bottom:10px">Oceane Marine replaces scattered spreadsheets, emails and folders with one integrated platform that:</p>
    <ul>
      <li>Plans and documents every STS transfer <strong style="color:#fff">(Operations)</strong></li>
      <li>Keeps all marine equipment tracked, tested and certified <strong style="color:#fff">(PMS)</strong></li>
      <li>Maintains a complete, audit-ready safety &amp; compliance system <strong style="color:#fff">(QHSE)</strong></li>
      <li>Keeps company certificates and personnel qualifications always valid <strong style="color:#fff">(HR)</strong></li>
      <li>Brings the entire SharePoint document archive in automatically</li>
      <li>Sends proactive reminders so no deadline is ever missed</li>
    </ul>
    <p class="punch">The result is safer operations, guaranteed compliance, lower risk, and the credibility needed to win and keep major clients.</p>
  </div>

</div>
</body></html>`;

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "0", bottom: "60px", left: "0", right: "0" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 60px;display:flex;justify-content:space-between;">' +
    "<span>Oceane Marine — Application Overview</span>" +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
});
await browser.close();
console.log("✅ PDF generated:", OUT);
