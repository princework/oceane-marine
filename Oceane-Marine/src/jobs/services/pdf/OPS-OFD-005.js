import fs from "node:fs";
import { loadSignatureImage } from "./shared/loadSignatureImage.js";
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
    VerticalAlign,
    ImageRun
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

const FORM_TITLE = "AT SEA SHIP TO SHIP TRANSFER CHECKLIST 5A-C – AFTER CONNECTION CHECKS TILL DISCONNECTION";

export async function generateOpsOfd005Doc(checklist, fullPath) {
    const transferInfo = checklist.transferInfo || {};
    const checklist5A = checklist.checklist5A || [];
    const checklist5BShip = checklist.checklist5BShip || {};
    const checklist5CTerminal = checklist.checklist5CTerminal || {};
    const signature = checklist.signature || {};

    const totalPages = 4;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(checklist, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildTransferInfoTable(transferInfo),
        new Paragraph({ spacing: { before: 200 } }),

        new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
                new TextRun({
                    text: "Checklist 5A After Connection Checks before Operation",
                    bold: true,
                    size: FONT_SIZE
                })
            ]
        }),
        buildChecklist5ATable(checklist5A),
        new Paragraph({ spacing: { before: 200 } }),

        new Paragraph({
            spacing: { before: 200 },
            children: [
                new TextRun({
                    text: "Checklist 5B Ship repetitive checks during transfer",
                    bold: true,
                    size: FONT_SIZE
                })
            ]
        }),

        new Paragraph({
            tabStops: [
                { type: AlignmentType.RIGHT, position: 9000 }
            ],
            children: [
                new TextRun(
                    `Note interval: ${checklist5BShip.noteIntervalHours || ""} hrs.`
                ),
                new TextRun("\t"),
                new TextRun(
                    `For Ship: ${checklist5BShip.entityName || ""}`
                )
            ]
        }),

        new Paragraph({ spacing: { before: 400 } }),
        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 2 ==========
    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(checklist, 2, totalPages, FORM_TITLE),

        new Paragraph({ spacing: { before: 200 } }),

        // ✅ CONTINUATION OF 5B (NO HEADER, NO NOTE LINE)
        buildChecklist5BTable(checklist5BShip, false),

        new Paragraph({ spacing: { before: 600 } }),

        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 3 ==========
    const page3Children = [
        buildHeaderTable(checklist, 3, totalPages, FORM_TITLE),

        new Paragraph({ spacing: { before: 200 } }),

        // ✅ SECTION TITLE
        new Paragraph({
            spacing: { before: 200 },
            children: [
                new TextRun({
                    text: "CL 5C – TERMINAL REPETATIVE CHECKS DURING TRANSFER",
                    bold: true,
                    size: FONT_SIZE
                })
            ]
        }),

        // ✅ NOTE + TERMINAL LINE
        new Paragraph({
            spacing: { after: 100 },
            children: [
                new TextRun({
                    text: `Note Interval: ${checklist5CTerminal.noteIntervalHours || ""} Hrs`
                }),
                new TextRun({ text: "                              " }),
                new TextRun({
                    text: `Terminal: ${checklist5CTerminal.entityName || ""}`
                })
            ]
        }),

        // ✅ TABLE
        buildChecklist5CTable(checklist5CTerminal),

        new Paragraph({ spacing: { before: 200 } }),

        buildNameRankFields(signature),

        new Paragraph({ spacing: { before: 200 } }),

        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 4 ==========
    const page4Children = [
        buildHeaderTable(checklist, 4, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildSignatureSection(signature),
        // Spacer to push footer down
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
            },
            {
                properties: { page: { margin: pageMargins } },
                children: page3Children
            },
            {
                properties: { page: { margin: pageMargins } },
                children: page4Children
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

// ================================================================
// TRANSFER INFO TABLE
// ================================================================
function buildTransferInfoTable(info) {
    const rows = [
        makeInfoRow("Constant Heading Ship:", info.constantHeadingShip || ""),
        makeInfoRow("Maneuvering Ship:", info.manoeuvringShip || ""),
        makeInfoRow("Name of Designated POAC:", info.designatedPOACName || ""),
        makeInfoRow("Name of STS Superintendent If Different from POAC:", info.stsSuperintendentName || ""),
        makeInfoRow("Date of Transfer:", info.transferDate ? formatDate(info.transferDate) : ""),
        makeInfoRow("Location of Transfer:", info.transferLocation || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
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
                            new TextRun({ text: label, bold: true, size: FONT_SIZE })
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

function fullBorders() {
    return {
        top: makeBorder(),
        bottom: makeBorder(),
        left: makeBorder(),
        right: makeBorder(),
        insideHorizontal: makeBorder(),
        insideVertical: makeBorder()
    };
}

function createHeaderCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D3D3D3" },
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, bold: true, size: FONT_SIZE })
                ]
            })
        ]
    });
}

function createCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, size: FONT_SIZE })
                ]
            })
        ]
    });
}
// ================================================================
// CHECKLIST 5A TABLE
// ================================================================
function buildChecklist5ATable(items) {

    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL 5A", 8),
            createHeaderCell("Check", 57),
            createHeaderCell("Status", 15, true),
            createHeaderCell("Remarks", 20, true)
        ]
    });

    const dataRows = items.map(item => {

        const statusText = item.status?.notApplicable
            ? "☐ Yes     ☑ Not applicable"
            : "☐ Yes";

        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 57),
                createCell(statusText, 15),
                createCell(item.remarks || "", 20)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// CHECKLIST 5B TABLE
// ================================================================
function buildChecklist5BTable(section, isFirstPage) {

    const rows = [];

    rows.push(new TableRow({
        children: [
            createHeaderCell("Check", 30),
            createHeaderCell("Ref.", 8, true),
            ...Array.from({ length: 6 }, () => createHeaderCell("Time", 8, true)),
            createHeaderCell("Remarks", 14, true)
        ]
    }));

    if (isFirstPage) {
        rows.push(new TableRow({
            children: [
                createCell("Date/time of check", 30),
                createCell("", 8),
                ...Array.from({ length: 6 }, () => createCell("", 8)),
                createCell("", 14)
            ]
        }));
    }

    (section.rows || []).forEach(row => {
        rows.push(new TableRow({
            children: [
                createCell(row.checkName || "", 30),
                createCell("", 8),
                ...Array.from({ length: 6 }, (_, i) =>
                    createCell(row.timeChecks?.[i]?.yes ? "☑ Yes" : "☐ Yes", 8, true)
                ),
                createCell(row.remarks || "", 14)
            ]
        }));
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}
// ================================================================
// CHECKLIST 5C TABLE
// ================================================================
function buildChecklist5CTable(section) {

    const rows = [];

    rows.push(new TableRow({
        children: [
            createHeaderCell("Date/time of check", 30),
            ...Array.from({ length: 6 }, () => createHeaderCell("Time", 8, true)),
            createHeaderCell("Remarks", 22, true)
        ]
    }));

    (section.rows || []).forEach(row => {
        rows.push(new TableRow({
            children: [
                createCell(row.checkName || "", 30),
                ...Array.from({ length: 6 }, (_, i) =>
                    createCell(row.timeChecks?.[i]?.yes ? "☑ Yes" : "☐ Yes", 8, true)
                ),
                createCell(row.remarks || "", 22)
            ]
        }));
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}
// ================================================================
// NAME AND RANK FIELDS
// ================================================================
function buildNameRankFields(signature) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Name:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.name || "", size: FONT_SIZE })
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
                                    new TextRun({ text: "Rank:", bold: true, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.rank || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// SIGNATURE SECTION
// ================================================================
function buildSignatureSection(signature) {
    const signatureImage = loadSignatureImage(signature.signature, "OPS-OFD-005");

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({ text: "Signature:", size: FONT_SIZE })
                                ]
                            }),
                            signatureImage ? new Paragraph({
                                spacing: { after: 200 },
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new ImageRun({
                                        data: signatureImage,
                                        transformation: { width: 200, height: 100 }
                                    })
                                ]
                            }) : new Paragraph({
                                spacing: { after: 200 },
                                children: [
                                    new TextRun({ text: "", size: FONT_SIZE })
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
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({ text: "Date:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 200 },
                                children: [
                                    new TextRun({ text: signature.date ? formatDate(signature.date) : "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// FOOTER LINE
// ================================================================
function buildFooterLine(title) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: title.toUpperCase(),
                italics: true,
                size: FONT_SIZE_SMALL
            })
        ]
    });
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================
function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

