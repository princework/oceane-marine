import fs from "node:fs";
import path from "node:path";
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

const makeBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000"
});

const FORM_TITLE = "Master's Feedback Form";

// ========== 20 PERFORMANCE CRITERIA ==========
const PERFORMANCE_CRITERIA = [
    { srNo: 1, criteria: "Was pre-operation information adequate and satisfactory" },
    { srNo: 2, criteria: "Was always the POAC professional and courteous?" },
    { srNo: 3, criteria: "Was the PPE worn at appropriate times by POAC?" },
    { srNo: 4, criteria: "Safety awareness of POAC" },
    { srNo: 5, criteria: "Toolbox talks - before rigging of vessel with fenders" },
    { srNo: 6, criteria: "Toolbox talks - before berthing and mooring operations\n(Including instruction to regularly tend vessel and fender moorings)" },
    { srNo: 7, criteria: "Toolbox talks - before Hose connection" },
    { srNo: 8, criteria: "Toolbox talks – before Cargo transfer\n(Including hazard precautions, i.e H2S monitors)" },
    { srNo: 9, criteria: "Toolbox talks – before Unmooring operations and vessel separation" },
    { srNo: 10, criteria: "POAC's communication skills with crew" },
    { srNo: 11, criteria: "Suitable positioning of fenders" },
    { srNo: 12, criteria: "Vessel moorings checked by POAC" },
    { srNo: 13, criteria: "Condition of Mooring Equipment" },
    { srNo: 14, criteria: "Navigation warning broadcast by POAC" },
    { srNo: 15, criteria: "Condition of Mooring Equipment" },
    { srNo: 16, criteria: "Operation discussed with vessel Master" },
    { srNo: 17, criteria: "Approach and mooring plan agreed" },
    { srNo: 18, criteria: "Joining of hose string and manifold connection supervised by POAC" },
    { srNo: 19, criteria: "Regular deck rounds during transfer by POAC" },
    { srNo: 20, criteria: "Overall operational rating" },
];

export async function generateOpsOfd020Doc(form, fullPath) {
    const jobDetails = form.jobDetails || {};
    const performanceItems = form.performanceItems || [];
    const overallFeedback = form.overallFeedback || "";
    const signature = form.signature || {};

    const totalPages = 2;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(form, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildJobDetailsTable(jobDetails),
        new Paragraph({ spacing: { before: 200 } }),
        buildIntroText(),
        new Paragraph({ spacing: { before: 100 } }),
        buildRatingScale(),
        new Paragraph({ spacing: { before: 200 } }),
        buildPerformanceTable(1, 14, performanceItems),
    ];

    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(form, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildPerformanceTable(15, 20, performanceItems),
        new Paragraph({ spacing: { before: 200 } }),
        buildOverallFeedbackSection(overallFeedback),
        new Paragraph({ spacing: { before: 200 } }),
        buildSignatureSection(signature),
    ];

    // ========== BUILD DOCUMENT ==========
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: { top: 500, bottom: 500, left: 700, right: 700 },
                    },
                },
                children: page1Children,
            },
            {
                properties: {
                    page: {
                        margin: { top: 500, bottom: 500, left: 700, right: 700 },
                    },
                },
                children: page2Children,
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
    console.log(`✅ OPS-OFD-020 document saved to: ${fullPath}`);
}

// ========== JOB DETAILS TABLE ==========
function buildJobDetailsTable(jobDetails) {
    const makeRow = (label, value) => {
        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    shading: { fill: "F2F2F2" },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: label, bold: true, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 70, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
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
    };

    let dateStr = "";
    if (jobDetails.dateOfOperation) {
        try {
            const d = new Date(jobDetails.dateOfOperation);
            if (!Number.isNaN(d.getTime())) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
        } catch { /* ignore */ }
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
        rows: [
            makeRow("Vessel's Name:", jobDetails.vesselName || ""),
            makeRow("Date of Operation:", dateStr),
            makeRow("Location:", jobDetails.location || ""),
            makeRow("Name of POAC:", jobDetails.nameOfPOAC || ""),
        ]
    });
}

// ========== INTRO TEXT ==========
function buildIntroText() {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
            new TextRun({
                text: "We want to serve you better and are committed to continuously improving our client service standards and in order to help us maintain / improve our quality of service, we would be grateful if you could spare a few minutes of your time during the transfer operation, to complete this questionnaire and submit.",
                size: FONT_SIZE,
                italics: true,
            })
        ]
    });
}

// ========== RATING SCALE ==========
function buildRatingScale() {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
            new TextRun({
                text: "Kindly provide rank for each criterion of performance based as per below:",
                size: FONT_SIZE,
                bold: true,
            })
        ]
    });
}

// ========== PERFORMANCE TABLE ==========
function buildPerformanceTable(startNo, endNo, performanceItems) {
    // Header row
    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9E2F3" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Sr.\nNo.", bold: true, size: FONT_SIZE_SMALL })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 52, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9E2F3" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Criteria of performance under review", bold: true, size: FONT_SIZE_SMALL })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 12, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9E2F3" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Score", bold: true, size: FONT_SIZE_SMALL })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 28, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "D9E2F3" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "Comments\n(Particularly if performance below 3)", bold: true, size: FONT_SIZE_SMALL })
                        ]
                    })
                ]
            }),
        ]
    });

    // Add rating scale row only on page 1 (before the performance items)
    const rows = [headerRow];

    if (startNo === 1) {
        // Rating scale row spanning full width
        const ratingRow = new TableRow({
            children: [
                new TableCell({
                    columnSpan: 4,
                    margins: CELL_MARGIN,
                    shading: { fill: "F2F2F2" },
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 40, after: 40 },
                            children: [
                                new TextRun({ text: "5 = Excellent       4 = Good       3 = Average       2 = Needs Improvement       1 = Unsatisfactory", size: FONT_SIZE_SMALL, bold: true })
                            ]
                        })
                    ]
                })
            ]
        });
        rows.push(ratingRow);
    }

    // Data rows
    for (let i = startNo; i <= endNo; i++) {
        const criteriaItem = PERFORMANCE_CRITERIA.find(c => c.srNo === i);
        if (!criteriaItem) continue;

        // Find the saved item
        const savedItem = performanceItems.find(p => p.srNo === i);
        const score = savedItem?.score || "";
        const comments = savedItem?.comments || "";

        // Split criteria text by newline for italic sub-text
        const criteriaLines = criteriaItem.criteria.split("\n");

        const criteriaParagraphs = criteriaLines.map((line, idx) => {
            return new Paragraph({
                spacing: { before: idx > 0 ? 20 : 0 },
                children: [
                    new TextRun({
                        text: line,
                        size: FONT_SIZE,
                        italics: idx > 0, // Sub-lines are italic
                    })
                ]
            });
        });

        const dataRow = new TableRow({
            children: [
                new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: String(i), size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 52, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: criteriaParagraphs,
                }),
                new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: score, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: comments, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
            ]
        });

        rows.push(dataRow);
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
        rows,
    });
}

// ========== OVERALL FEEDBACK SECTION ==========
function buildOverallFeedbackSection(overallFeedback) {
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
                        margins: CELL_MARGIN,
                        shading: { fill: "D9E2F3" },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: "Overall Feedback and suggestion", bold: true, italics: true, size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        margins: CELL_MARGIN,
                        children: [
                            new Paragraph({
                                spacing: { before: 100, after: 100 },
                                children: [
                                    new TextRun({ text: overallFeedback || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            }),
        ]
    });
}

// ========== SIGNATURE SECTION ==========
function buildSignatureSection(signature) {
    const signatureImage = loadSignatureImage(signature.stampSignature, "OPS-OFD-020");

    let dateStr = "";
    if (signature.date) {
        try {
            const d = new Date(signature.date);
            if (!Number.isNaN(d.getTime())) {
                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
        } catch { /* ignore */ }
    }

    const makeDetailRow = (label, value) => {
        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    shading: { fill: "F2F2F2" },
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
                    width: { size: 70, type: WidthType.PERCENTAGE },
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
    };

    // Stamp & Signature row with image
    const stampRow = new TableRow({
        children: [
            new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                shading: { fill: "F2F2F2" },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Stamp & Signature", bold: true, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: signatureImage
                    ? [
                        new Paragraph({
                            children: [
                                new ImageRun({
                                    data: signatureImage,
                                    transformation: { width: 200, height: 80 },
                                })
                            ]
                        })
                    ]
                    : [
                        new Paragraph({
                            spacing: { before: 400, after: 400 },
                            children: [
                                new TextRun({ text: "", size: FONT_SIZE })
                            ]
                        })
                    ]
            })
        ]
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
        rows: [
            makeDetailRow("Master Name", signature.masterName || ""),
            stampRow,
            makeDetailRow("Date", dateStr),
        ]
    });
}
