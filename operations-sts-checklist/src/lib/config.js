/**
 * API and form configuration for STS Checklist.
 * Use same-origin proxy to avoid CORS; proxy forwards to NEXT_PUBLIC_API_BASE_URL.
 *
 * External forms have no Oceane login; the main app allows anonymous create/read/update
 * (`isPublicOperationsStsChecklistRoute` in Oceane-Marine `src/middleware.js`).
 * DELETE checklist records still requires a logged-in session.
 */
export const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api/sts-proxy'
    : process.env.NEXT_PUBLIC_API_BASE_URL ||
      'http://localhost:3000/api/operations/sts-checklist';

export const FORM_TITLES = {
  'OPS-OFD-005E': 'Declaration Of STS At Sea',
  'OPS-OFD-001': 'Before Operation Commence',
  'OPS-OFD-001A': 'Ship Standard Questionnaire',
  'OPS-OFD-002': 'Before Run In & Mooring',
  'OPS-OFD-003': 'Before Cargo Transfer (3A & 3B)',
  'OPS-OFD-004': 'Pre-Transfer Agreements (4A-4F)',
  'OPS-OFD-005': 'During Transfer (5A-5C)',
  'OPS-OFD-005B': 'Before Disconnection & Unmooring',
  'OPS-OFD-005C': 'Terminal Transfer Checklist',
  'OPS-OFD-005D': 'Declaration for STS operations (At port & Terminal)',
  'OPS-OFD-028': 'Personnel Transfer Basket Checklist',
  'OPS-OFD-009': "Mooring Master's Job Report",
  'OPS-OFD-011': 'STS Standing Order',
  'OPS-OFD-014': 'Equipment Checklist',
  'OPS-OFD-015': 'Hourly Quantity Log',
  'OPS-OFD-018': 'STS Timesheet',
  'OPS-OFD-020': "Master's Feedback Form",
  'OPS-OFD-023': 'Record of Work Hours',
  'OPS-OFD-029': 'Mooring Master Expense Sheet',
};

export const FORMS = [
  { path: 'OPS-OFD-005E', formNo: 'OPS-OFD-005E' },
  { path: 'OPS-OFD-001', formNo: 'OPS-OFD-001' },
  { path: 'OPS-OFD-001A', formNo: 'OPS-OFD-001A' },
  { path: 'OPS-OFD-002', formNo: 'OPS-OFD-002' },
  { path: 'OPS-OFD-003', formNo: 'OPS-OFD-003' },
  { path: 'OPS-OFD-004', formNo: 'OPS-OFD-004' },
  { path: 'OPS-OFD-005', formNo: 'OPS-OFD-005' },
  { path: 'OPS-OFD-005B', formNo: 'OPS-OFD-005B' },
  { path: 'OPS-OFD-005C', formNo: 'OPS-OFD-005C' },
  { path: 'OPS-OFD-005D', formNo: 'OPS-OFD-005D' },
  { path: 'OPS-OFD-028', formNo: 'OPS-OFD-028' },
  { path: 'OPS-OFD-009', formNo: 'OPS-OFD-009' },
  { path: 'OPS-OFD-011', formNo: 'OPS-OFD-011' },
  { path: 'OPS-OFD-014', formNo: 'OPS-OFD-014' },
  { path: 'OPS-OFD-015', formNo: 'OPS-OFD-015' },
  { path: 'OPS-OFD-018', formNo: 'OPS-OFD-018' },
  { path: 'OPS-OFD-020', formNo: 'OPS-OFD-020' },
  { path: 'OPS-OFD-023', formNo: 'OPS-OFD-023' },
  { path: 'OPS-OFD-029', formNo: 'OPS-OFD-029' },
];
