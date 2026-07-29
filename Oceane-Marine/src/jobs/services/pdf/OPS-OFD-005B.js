import fs from "node:fs";
import path from "node:path";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    VerticalAlign
} from "docx";
import { buildHeaderTable } from "./shared/headerBuilder.js";

// ========== CONSTANTS ==========
const FONT_SIZE = 18; // ~9pt
const FONT_SIZE_SMALL = 16; // ~8pt
const CELL_MARGIN = { top: 40, bottom: 40, left: 60, right: 60 };

// ✅ FIX: Create new border object each time to avoid docx mutation bug
const makeBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000"
});

// ✅ FIX: Use makeBorder() to create unique objects (no shared reference)
const TABLE_BORDERS = {
    top: makeBorder(),
    bottom: makeBorder(),
    left: makeBorder(),
    right: makeBorder(),
    insideHorizontal: makeBorder(),
    insideVertical: makeBorder()
};

const FORM_TITLE = "CHECKLIST 6A & B- CHECKS BEFORE & AFTER DISCONNECTION";

export async function generateOpsOfd005bDoc(checklist, fullPath) {

    // Debug: Log received data
    console.log("📋 DOCX Generation - Received checklist data:", {
        hasTransferInfo: !!checklist.transferInfo,
        transferInfo: checklist.transferInfo,
        hasChecklist6A: !!checklist.checklist6A,
        checklist6A: checklist.checklist6A,
        checklist6AChecksCount: checklist.checklist6A?.checks?.length || 0,
        checklist6BCount: checklist.checklist6B?.length || 0,
        hasResponsiblePersons: !!checklist.responsiblePersons,
        responsiblePersons: checklist.responsiblePersons,
    });

    const transferInfo = checklist.transferInfo || {};
    const checklist6A = checklist.checklist6A?.checks || [];
    const pipelineConditions = checklist.checklist6A?.pipelineConditions || {};
    const checklist6B = checklist.checklist6B || [];
    const responsiblePersons = checklist.responsiblePersons || {};

    // Debug: Log extracted data
    console.log("📋 DOCX Generation - Extracted data:", {
        transferInfo,
        checklist6ACount: checklist6A.length,
        pipelineConditions,
        checklist6BCount: checklist6B.length,
        responsiblePersons,
    });

    const totalPages = 2;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(checklist, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildTransferDetailsTable(transferInfo),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist6ATable(checklist6A.slice(0, 6), pipelineConditions),
        // Spacer to push footer down to bottom
        new Paragraph({ spacing: { before: 600 } }),
        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(checklist, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist6ATable(checklist6A.slice(6)),
        new Paragraph({ spacing: { before: 200 } }),
        buildChecklist6BTable(checklist6B),
        new Paragraph({ spacing: { before: 200 } }),
        buildResponsiblePersonsTable(responsiblePersons),
        // Spacer to push footer down to bottom
        new Paragraph({ spacing: { before: 600 } }),
        buildFooterLine(FORM_TITLE)
    ];

    const pageMargins = {
        top: 500,
        right: 600,
        bottom: 500,
        left: 600
    };

    const doc = new Document({
        sections: [
            {
                properties: { page: { margin: pageMargins } },
                children: page1Children
            },
            {
                properties: { page: { margin: pageMargins } },
                children: page2Children
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

// ================================================================
// TRANSFER DETAILS TABLE
// ================================================================
function buildTransferDetailsTable(info) {
    const rows = [
        makeInfoRow("Constant Heading Ship:", info.constantHeadingShip),
        makeInfoRow("Maneuvering Ship:", info.manoeuvringShip),
        makeInfoRow("Name of Designated POAC:", info.designatedPOACName),
        makeInfoRow("Name of STS Superintendent if Different from POAC:", info.stsSuperintendentName),
        makeInfoRow("Date of Transfer:", info.transferDate ? formatDate(info.transferDate) : ""),
        makeInfoRow("Location of Transfer:", info.transferLocation)
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows
    });
}

function makeInfoRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: label, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: value || "", size: FONT_SIZE })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// CHECKLIST 6A TABLE
// ================================================================
function buildChecklist6ATable(items, pipelineConditions = {}) {
    if (!items || items.length === 0) {
        return new Paragraph({ text: "" });
    }

    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            makeHeaderCell("CL", 8, AlignmentType.LEFT),
            makeHeaderCell("Activities", 57, AlignmentType.LEFT),
            makeHeaderCell("Status", 15, AlignmentType.CENTER),
            makeHeaderCell("Remarks", 20, AlignmentType.CENTER),
        ]
    });

    // Data rows
    const dataRows = items.map((item, index) => {
        const clNumber = item.clNumber || (index + 1);
        const description = item.description || "";
        const statusYes = item.status?.yes ? "☑" : "☐";
        const statusNotApplicable = item.status?.notApplicable ? "☑" : "☐";
        const remarks = item.remarks || "";

        // Special handling for item 2 (index 1) - pipeline conditions in remarks
        let remarksText = remarks;
        if (index === 1 && clNumber === 2) {
            const pipelineText = [];
            if (pipelineConditions.purged) pipelineText.push("Purged");
            if (pipelineConditions.inerted) pipelineText.push("Inerted");
            if (pipelineConditions.depressurized) pipelineText.push("Depressurized");
            if (pipelineText.length > 0) {
                remarksText = pipelineText.join(". ");
            }
        }

        return new TableRow({
            children: [
                // CL Number
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: String(clNumber), size: FONT_SIZE, bold: true })
                            ]
                        })
                    ]
                }),
                // Activities
                new TableCell({
                    width: { size: 57, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: description, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                // Status
                new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ 
                                    text: `${statusYes} Yes${statusNotApplicable ? "\n☑ Not applicable" : ""}`, 
                                    size: FONT_SIZE_SMALL 
                                })
                            ]
                        })
                    ]
                }),
                // Remarks
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: remarksText || "", size: FONT_SIZE_SMALL })
                            ]
                        })
                    ]
                })
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// CHECKLIST 6B TABLE
// ================================================================
function buildChecklist6BTable(items) {
    if (!items || items.length === 0) {
        return new Paragraph({ text: "" });
    }

    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            makeHeaderCell("CL", 8, AlignmentType.CENTER),
            makeHeaderCell("Activities", 52, AlignmentType.LEFT),
            makeHeaderCell("Status", 20, AlignmentType.CENTER),
            makeHeaderCell("Remarks", 20, AlignmentType.CENTER),
        ]
    });

    // Data rows
    const dataRows = items.map((item, index) => {
        const clNumber = item.clNumber || (index + 1);
        const description = item.description || "";
        const statusYes = item.status?.yes ? "☑" : "☐";
        const statusNotApplicable = item.status?.notApplicable ? "☑" : "☐";
        const remarks = item.remarks || "";

        return new TableRow({
            children: [
                // CL Number
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: String(clNumber), size: FONT_SIZE, bold: true })
                            ]
                        })
                    ]
                }),
                // Activities
                new TableCell({
                    width: { size: 52, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: description, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                // Status
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ 
                                    text: `${statusYes} Yes${statusNotApplicable ? "\n☑ Not applicable" : ""}`, 
                                    size: FONT_SIZE_SMALL 
                                })
                            ]
                        })
                    ]
                }),
                // Remarks
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: remarks || "", size: FONT_SIZE_SMALL })
                            ]
                        })
                    ]
                })
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// RESPONSIBLE PERSONS TABLE
// ================================================================
function buildResponsiblePersonsTable(persons) {
    const rows = [
        makeResponsibleRow("Officer in charge of CHS:", persons.chsOfficerName),
        makeResponsibleRow("Officer in charge of MS:", persons.msOfficerName),
        makeResponsibleRow("Terminal:", persons.terminalName),
        makeResponsibleRow("STS Supdt:", persons.stsSuperintendentName),
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows
    });
}

function makeResponsibleRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: label, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: `Name: ${value || ""}`, size: FONT_SIZE })
                        ]
                    })
                ]
            })
        ]
    });
}

function makeHeaderCell(text, widthPercent, alignment = AlignmentType.LEFT) {
    return new TableCell({
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D3D3D3" }, // Grey background
        children: [
            new Paragraph({
                alignment: alignment,
                children: [
                    new TextRun({ text, bold: true, size: FONT_SIZE })
                ]
            })
        ]
    });
}

// ================================================================
// FOOTER LINE
// ================================================================
function buildFooterLine(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [
            new TextRun({
                text: text || "",
                bold: true,
                size: FONT_SIZE
            })
        ]
    });
}

// ================================================================
// UTILITIES
// ================================================================
function formatDate(date) {
    if (!date) return "";
    try {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return "";
    }
}
