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
    VerticalAlign,
    ImageRun,
    PageOrientation
} from "docx";
import { buildHeaderTable } from "./shared/headerBuilder.js";

// ========== CONSTANTS ==========
const FONT_SIZE = 14; // ~7pt for compact grid
const FONT_SIZE_SMALL = 12; // ~6pt
const FONT_SIZE_HEADER = 16; // ~8pt
const CELL_MARGIN_SMALL = { top: 20, bottom: 20, left: 30, right: 30 };
const CELL_MARGIN_TINY = { top: 10, bottom: 10, left: 15, right: 15 };

const makeBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 4,
    color: "000000"
});

const makeThickBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000"
});

const FORM_TITLE = "Record of Work Hours";

// Hour labels for the 24 columns
const HOUR_LABELS = [
    "01:00", "02:00", "03:00", "04:00", "05:00", "06:00",
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    "19:00", "20:00", "21:00", "22:00", "23:00", "23:59"
];

export async function generateOpsOfd023Doc(form, fullPath) {
    const headerDetails = form.headerDetails || {};
    const workEntries = form.workEntries || [];
    const notes = Array.isArray(form.notes) ? form.notes : [];

    console.log("📝 OPS-OFD-023 notes data:", JSON.stringify(notes));

    const totalPages = 1;

    // ========== PAGE 1 (Landscape) ==========
    const page1Children = [
        buildHeaderTable(form, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 150 } }),
        buildInfoSection(headerDetails),
        new Paragraph({ spacing: { before: 100 } }),
        buildInstructionText(),
        new Paragraph({ spacing: { before: 80 } }),
        buildWorkHoursGrid(workEntries),
        new Paragraph({ spacing: { before: 150 } }),
        buildNotesSection(notes),
    ];

    // ========== BUILD DOCUMENT (Landscape) ==========
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 400, bottom: 400, left: 500, right: 500 },
                        size: {
                            orientation: PageOrientation.LANDSCAPE,
                        },
                    },
                },
                children: page1Children,
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    console.log(`✅ OPS-OFD-023 document saved to: ${fullPath}`);
}

// ========== INFO SECTION (STS, Operat., Date, Moor. Master, Remark) ==========
function buildInfoSection(headerDetails) {
    let dateStr = "";
    if (headerDetails.date) {
        try {
            const d = new Date(headerDetails.date);
            if (!Number.isNaN(d.getTime())) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
        } catch { /* ignore */ }
    }

    const makeInfoRow = (labels) => {
        const cells = [];
        for (const { label, value, width } of labels) {
            cells.push(
                new TableCell({
                    width: { size: width || 50, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN_SMALL,
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                    },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: label, bold: true, size: FONT_SIZE_HEADER }),
                                new TextRun({ text: "  " + (value || "_______________"), size: FONT_SIZE_HEADER }),
                            ]
                        })
                    ]
                })
            );
        }
        return new TableRow({ children: cells });
    };

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
            makeInfoRow([
                { label: "STS Operat.:", value: headerDetails.stsOperation || "", width: 50 },
                { label: "Date:", value: dateStr || "", width: 50 },
            ]),
            makeInfoRow([
                { label: "Moor. Master:", value: headerDetails.mooringMaster || "", width: 50 },
                { label: "Remark:", value: headerDetails.remark || "", width: 50 },
            ]),
        ]
    });
}

// ========== INSTRUCTION TEXT ==========
function buildInstructionText() {
    return new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
            new TextRun({
                text: "PLEASE MARK PERIOD OF WORK ONLY BY CONTINUOUS LINE.  REST PERIOD TO BE LEFT BLANK",
                bold: true,
                size: FONT_SIZE_HEADER,
            })
        ]
    });
}

// ========== MAIN WORK HOURS GRID ==========
function buildWorkHoursGrid(workEntries) {
    // Build the lookup map: day -> workEntry
    const entryMap = {};
    for (const entry of workEntries) {
        if (entry.day) entryMap[entry.day] = entry;
    }

    // === HEADER ROW 1: "HOURS" + time labels + "HOURS OF REST IN 24 HOURS" + "COMMENTS" ===
    const headerCells = [
        new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            shading: { fill: "FFFFFF" },
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "HOURS", bold: true, size: FONT_SIZE_SMALL })
                    ]
                })
            ]
        }),
    ];

    // 24 hour columns
    for (const label of HOUR_LABELS) {
        headerCells.push(
            new TableCell({
                width: { size: 3, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN_TINY,
                shading: { fill: "000000" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: label, bold: true, size: FONT_SIZE_SMALL, color: "FFFFFF" })
                        ]
                    })
                ]
            })
        );
    }

    // Hours of Rest column
    headerCells.push(
        new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            shading: { fill: "FFFFFF" },
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "HOURS OF REST", bold: true, size: FONT_SIZE_SMALL })
                    ]
                })
            ]
        })
    );

    // Comments column
    headerCells.push(
        new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            shading: { fill: "FFFFFF" },
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "COMMENTS", bold: true, size: FONT_SIZE_SMALL })
                    ]
                })
            ]
        })
    );

    const headerRow = new TableRow({
        tableHeader: true,
        children: headerCells,
    });

    // === HEADER ROW 2: "DATE" + black filled cells + "IN 24 HOURS" ===
    const subHeaderCells = [
        new TableCell({
            width: { size: 4, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            shading: { fill: "FFFFFF" },
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "DATE", bold: true, size: FONT_SIZE_SMALL })
                    ]
                })
            ]
        }),
    ];

    // 24 black cells under hours
    for (let i = 0; i < 24; i++) {
        subHeaderCells.push(
            new TableCell({
                width: { size: 3, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN_TINY,
                shading: { fill: "000000" },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: "", size: FONT_SIZE_SMALL })]
                    })
                ]
            })
        );
    }

    // "IN 24 HOURS" label
    subHeaderCells.push(
        new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            shading: { fill: "FFFFFF" },
            verticalAlign: VerticalAlign.CENTER,
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "IN 24 HOURS", bold: true, size: FONT_SIZE_SMALL, color: "FF0000" })
                    ]
                })
            ]
        })
    );

    // Empty comments cell
    subHeaderCells.push(
        new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            margins: CELL_MARGIN_TINY,
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "", size: FONT_SIZE_SMALL })]
                })
            ]
        })
    );

    const subHeaderRow = new TableRow({ children: subHeaderCells });

    // === DATA ROWS: Days 01-31 ===
    const dataRows = [];
    for (let day = 1; day <= 31; day++) {
        const entry = entryMap[day] || {};
        const hourSlots = entry.hourSlots || Array(24).fill(false);

        const dayCells = [
            // Day number
            new TableCell({
                width: { size: 4, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN_TINY,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: String(day).padStart(2, "0"),
                                bold: true,
                                size: FONT_SIZE
                            })
                        ]
                    })
                ]
            }),
        ];

        // 24 hour slot cells
        for (let h = 0; h < 24; h++) {
            const isWorking = hourSlots[h] === true;
            dayCells.push(
                new TableCell({
                    width: { size: 3, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN_TINY,
                    shading: isWorking ? { fill: "333333" } : { fill: "FFFFFF" },
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: isWorking ? "█" : "", size: FONT_SIZE_SMALL })
                            ]
                        })
                    ]
                })
            );
        }

        // Hours of rest
        const hoursOfRest = entry.hoursOfRest != null ? String(entry.hoursOfRest) : "";
        dayCells.push(
            new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN_TINY,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: hoursOfRest, size: FONT_SIZE })
                        ]
                    })
                ]
            })
        );

        // Comments
        dayCells.push(
            new TableCell({
                width: { size: 10, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN_TINY,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: entry.comments || "", size: FONT_SIZE })
                        ]
                    })
                ]
            })
        );

        dataRows.push(new TableRow({ children: dayCells }));
    }

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
        rows: [headerRow, subHeaderRow, ...dataRows],
    });
}

// ========== NOTES SECTION ==========
function buildNotesSection(notes) {
    // notes is now a dynamic array of strings
    const noteLines = Array.isArray(notes) ? notes : [];

    // If no notes, still show the header
    if (noteLines.length === 0) {
        noteLines.push("");
    }

    const rows = [
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 2,
                    margins: CELL_MARGIN_SMALL,
                    shading: { fill: "F2F2F2" },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "NOTES:", bold: true, size: FONT_SIZE_HEADER })
                            ]
                        })
                    ]
                })
            ]
        }),
    ];

    noteLines.forEach((note, idx) => {
        rows.push(
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 8, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN_SMALL,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: String(idx + 1).padStart(2, "0"),
                                        bold: true,
                                        size: FONT_SIZE
                                    })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 92, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN_SMALL,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: String(note || ""), size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        );
    });

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
        rows,
    });
}
