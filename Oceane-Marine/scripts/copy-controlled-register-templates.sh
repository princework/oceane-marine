#!/usr/bin/env bash
# Copy form templates from Forms - QHSE and Forms - Operations into
# public/templates/controlled-register/ for the Controlled Document Register.
# Run from repo root. Adjust SRC_QHSE and SRC_OPS if your form folders are elsewhere.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${REPO_ROOT}/public/templates/controlled-register"
SRC_QHSE="${REPO_ROOT}/../Forms - QHSE"
SRC_OPS="${REPO_ROOT}/../Forms - Operations"

# If not found relative to repo, try absolute paths
[[ -d "$SRC_QHSE" ]] || SRC_QHSE="/Users/himanshu/Downloads/Forms - QHSE"
[[ -d "$SRC_OPS" ]] || SRC_OPS="/Users/himanshu/Downloads/Forms - Operations"

mkdir -p "$DEST"

copy_qhse() {
  local src="$1"
  local dest_name="$2"
  if [[ -f "$SRC_QHSE/$src" ]]; then
    cp "$SRC_QHSE/$src" "$DEST/$dest_name"
    echo "QHSE: $src -> $dest_name"
  else
    echo "Skip (not found): $SRC_QHSE/$src"
  fi
}

copy_ops() {
  local src="$1"
  local dest_name="$2"
  if [[ -f "$SRC_OPS/$src" ]]; then
    cp "$SRC_OPS/$src" "$DEST/$dest_name"
    echo "OPS: $src -> $dest_name"
  else
    echo "Skip (not found): $SRC_OPS/$src"
  fi
}

# QHSE
copy_qhse "QAF-OFD-003  - STS Transfer Audit Report.docx" "QAF-OFD-003.docx"
copy_qhse "QAF-OFD-004  - STS Base Audit Report.docx" "QAF-OFD-004.docx"
copy_qhse "QAF-OFD-006  - Risk Assessment.xlsx" "QAF-OFD-006.xlsx"
copy_qhse "QAF-OFD-008  - HSE Induction Checklist.docx" "QAF-OFD-008.docx"
copy_qhse "QAF-OFD-009  - POAC Cross Comptency Evaluation.docx" "QAF-OFD-009.docx"
copy_qhse "QAF-OFD-013  - STS Equipment base stock level.docx" "QAF-OFD-013.docx"
copy_qhse "QAF-OFD-015  - Accident-Incident Reporting & Investigation form.docx" "QAF-OFD-015.docx"
copy_qhse "QAF-OFD-025  - Equipment Defect list.xlsx" "QAF-OFD-025.xlsx"
copy_qhse "QAF-OFD-037 -  Vendor OR Supplier Approval Form.xlsx" "QAF-OFD-037.xlsx"
copy_qhse "QAF-OFD-038  - Training Plan.docx" "QAF-OFD-038.docx"
copy_qhse "QAF-OFD-039  - Training Record.docx" "QAF-OFD-039.docx"
copy_qhse "QAF-OFD-040  - Drill Plan.docx" "QAF-OFD-040.docx"
copy_qhse "QAF-OFD-043  - Supplier Due Diligence Questionnaire.docx" "QAF-OFD-043.docx"
copy_qhse "QAF-OFD-048 -  Audit & Inspection Plan.xlsx" "QAF-OFD-048.xlsx"
copy_qhse "QAF-OFD-049 - STS Transfer Location Questionnaire.docx" "QAF-OFD-049.docx"
copy_qhse "QAF-OFD-051 - New Base Setup Checklist.docx" "QAF-OFD-051.docx"
copy_qhse "QAF-OFD-055 - Audit Form - Sub Contractor.docx" "QAF-OFD-055.docx"
copy_qhse "QAF-OFD-058  - Management of Change Form.docx" "QAF-OFD-058.docx"
copy_qhse "QAF-OFD-058A  - MOC-RA.docx" "QAF-OFD-058A.docx"
copy_qhse "QAF-OFD-001  - HSE Objectives & Targets.xlsx" "HSE-001-Objectives-Targets.xlsx"

# Operations
copy_ops "OPS-OFD-001 - STS Checklist 1 -  BEFORE OPERATION COMMENCE.docx" "OPS-OFD-001.docx"
copy_ops "OPS-OFD-001A_Rev1.3_Ship Standard Questionnaire.docx" "OPS-OFD-001A.docx"
copy_ops "OPS-OFD-002 - STS Checklist 2 - BEFORE RUN IN AND MOORING.docx" "OPS-OFD-002.docx"
copy_ops "OPS-OFD-003 - STS Checklist 3A & 3B  - BEFORE CARGO TRANSFER.docx" "OPS-OFD-003.docx"
copy_ops "OPS-OFD-004 - STS Checklist 4A-F – PRE TRANSFER CONFERENCE .docx" "OPS-OFD-004.docx"
copy_ops "OPS-OFD-005 - STS Checklist 5A-C – AFTER CONNECTION CHECKS TILL DISCONNECTION.docx" "OPS-OFD-005.docx"
copy_ops "OPS-OFD-005B- STS Checklist 6A & B– CHECKS BEFORE & AFTER  DISCONNECTION.docx" "OPS-OFD-005B.docx"
copy_ops "OPS-OFD-005C- STS Checklist 7 – CHECKS PRE TRANFER CONFERENCE ALONGSIDE A TERMINAL.docx" "OPS-OFD-005C.docx"
copy_ops "Declaration for STS operations at Sea.docx" "OPS-OFD-005E.docx"
copy_ops "OPS-OFD-006A - Joint Plan of  Operation Fujairah.docx" "OPS-OFD-006A.docx"
copy_ops "OPS-OFD-028 - Personnel Transfer Basket Checklist.docx" "OPS-OFD-028.docx"
copy_ops "OPS-OFD-009 - Mooring Master Job Report.docx" "OPS-OFD-009.docx"
copy_ops "OPS-OFD-011 - STS Superintendent Standing Orders.docx" "OPS-OFD-011.docx"
copy_ops "OPS-OFD-014 - STS Equipment Checklist.docx" "OPS-OFD-014.docx"
copy_ops "OPS-OFD-015 - Hourly Checks on Discharged - Received Quantities.xlsx" "OPS-OFD-015.xlsx"
copy_ops "OPS-OFD-018  - Timesheet.docx" "OPS-OFD-018.docx"
copy_ops "OPS-OFD-029 -  Mooring Master Expense Sheet.xlsx" "OPS-OFD-029.xlsx"
copy_ops "OPS-OFD-030 -  Quotation Form - STS Job.docx" "OPS-OFD-030.docx"

echo "Done. Templates in $DEST"
ls -la "$DEST"
