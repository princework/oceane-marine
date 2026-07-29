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
    ImageRun,
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

// Border for section outer borders (thinner than before)
const makeSectionBorder = () => ({
    style: BorderStyle.SINGLE,
    size: 4, // Thin border for section outer borders
    color: "000000"
});

const FORM_TITLE = "STS SUPERINTENDENT STANDING ORDER";

// ========== STATIC CONTENT ==========
const INTRODUCTION = `STS transfer operations are under the advisory control of the STS Superintendent. Each Master remains responsible for the safety of their own ship, crew, cargo and equipment and should not permit safety to be prejudiced by the actions of others.`;

const ENVIRONMENT_SECTION = {
    title: "Environment",
    instruction: "Inform Superintendent if:",
    items: [
        "Weather forecast indicates adverse conditions.",
        "Wind speed is increasing unexpectedly or consistently gusting above 20kts or as directed by the STS Superintendent.",
        "Local weather forecasts indicate an approaching deep low-pressure system or gusting winds.",
        "There are electrical storms in the vicinity.",
        "The vessel does not appear to be holding position."
    ]
};

const COMMUNICATIONS_SECTION = {
    title: "Communications",
    items: [
        "During cargo operations, essential personnel on both ships must have reliable and common means of communication.",
        "In case of communication breakdown on either ship, the emergency signal should be sounded, and all operations suspended immediately.",
        "Operations should not resume until satisfactory communications are re-established."
    ]
};

const EMERGENCY_SECTION = {
    title: "Emergency Situations",
    items: [
        "The agreed Emergency signal must be clearly understood by personnel on both ships.",
        "In an emergency, both vessels should immediately implement the appropriate contingency plan.",
        "Examples of emergency situations requiring suspension of cargo operations and calling the STS Superintendent are:",
        "• Accidental cargo release",
        "• Gas accumulation on deck",
        "• Any leakages at the manifold",
        "• Onset of adverse weather conditions",
        "• Electrical storms",
        "• Ships emergency",
        "• Safety infringements"
    ],
    readinessTitle: "State of readiness for an emergency:",
    readinessInstruction: "The following arrangements should be made on both ships:",
    readinessItems: [
        "Main engines steering gear ready for immediate use.",
        "Crew available and systems prepared to drain and disconnect hoses at short notice.",
        "Oil spill containment equipment prepared and ready for use.",
        "Mooring equipment ready for immediate use, and extra mooring lines ready at mooring stations as replacements in case of breakage.",
        "Firefighting equipment ready for immediate use."
    ]
};

const HOSES_SECTION = {
    title: "Hoses",
    instruction: "Hoses and their securing arrangement should be inspected during cargo operations.",
    informTitle: "Inform STS Superintendent if:",
    items: [
        "Hose connections are leaking.",
        "There is excessive movement of the hoses or hose kinking.",
        "If there is any doubt about the positioning of the hoses."
    ]
};

const MOORINGS_SECTION = {
    title: "Moorings",
    instruction: "Moorings should be inspected frequently and adjusted accordingly. Call STS Superintendent if:",
    items: [
        "Any moorings fall.",
        "the other vessel does not appear to be tending its mooring.",
        "Vessels are experiencing increased movement.",
        "If there is any doubt about the condition of the moorings."
    ]
};

const FENDERS_SECTION = {
    title: "Fenders",
    instruction: "Fenders must be inspected regularly during the cargo transfer operation. The fender moorings should be tended as required. Inform STS Superintendent if the following is observed:",
    items: [
        "Damage to fenders, fender moorings or associated equipment.",
        "There is excessive movement of fenders.",
        "If there is any doubt about the condition or position of the fenders."
    ]
};

const CARGO_OPERATIONS_SECTION = {
    title: "Cargo Operations",
    items: [
        "Maintain hourly exchange of cargo rate and quantity transferred with another vessel. Inform the STS Superintendent if there is a significant difference in figures.",
        "Ensure a crew member is always at the manifold.",
        "Call STS Superintendent if there are any changes to or deviations from the cargo transfer plan."
    ]
};

// ========== HELPER FUNCTIONS ==========


function formatDate(dateValue) {
    if (!dateValue) return "";
    try {
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return "";
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return "";
    }
}

function formatTime(timeValue) {
    if (!timeValue) return "";
    return String(timeValue);
}

function buildSection(section) {
    // Build content paragraphs for the section body
    const contentParagraphs = [];

    // Instruction if present
    if (section.instruction) {
        contentParagraphs.push(
            new Paragraph({
                spacing: { before: 100, after: 100 },
                children: [
                    new TextRun({
                        text: section.instruction,
                        size: FONT_SIZE
                    })
                ]
            })
        );
    }

    // Items
    section.items.forEach(item => {
        contentParagraphs.push(
            new Paragraph({
                spacing: { after: 60 },
                indent: { left: 400 },
                children: [
                    new TextRun({
                        text: item,
                        size: FONT_SIZE
                    })
                ]
            })
        );
    });

    // Readiness section if present
    if (section.readinessTitle) {
        contentParagraphs.push(
            new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [
                    new TextRun({
                        text: section.readinessTitle,
                        bold: true,
                        size: FONT_SIZE
                    })
                ]
            })
        );
    }

    if (section.readinessInstruction) {
        contentParagraphs.push(
            new Paragraph({
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: section.readinessInstruction,
                        size: FONT_SIZE
                    })
                ]
            })
        );
    }

    if (section.readinessItems) {
        section.readinessItems.forEach(item => {
            contentParagraphs.push(
                new Paragraph({
                    spacing: { after: 60 },
                    indent: { left: 400 },
                    children: [
                        new TextRun({
                            text: item,
                            size: FONT_SIZE
                        })
                    ]
                })
            );
        });
    }

    // Create complete section table with outer border covering header + content
    const sectionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeSectionBorder(),
            bottom: makeSectionBorder(),
            left: makeSectionBorder(),
            right: makeSectionBorder(),
        },
        rows: [
            // Header row with grey background
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        margins: { top: 60, bottom: 60, left: 80, right: 80 },
                        verticalAlign: VerticalAlign.CENTER,
                        borders: {
                            top: makeSectionBorder(),
                            bottom: makeBorder(), // Thin border between header and content
                            left: makeSectionBorder(),
                            right: makeSectionBorder(),
                        },
                        shading: { fill: "D3D3D3" }, // Grey background
                        children: [
                            new Paragraph({
                                spacing: { before: 0, after: 0 },
                                children: [
                                    new TextRun({
                                        text: section.title,
                                        bold: true,
                                        size: FONT_SIZE + 2
                                    })
                                ]
                            })
                        ]
                    })
                ]
            }),
            // Content row with all section content
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 80, right: 80 },
                        borders: {
                            top: makeBorder(), // Thin border between header and content
                            bottom: makeSectionBorder(),
                            left: makeSectionBorder(),
                            right: makeSectionBorder(),
                        },
                        children: contentParagraphs
                    })
                ]
            })
        ]
    });

    return [
        new Paragraph({ spacing: { before: 200 } }),
        sectionTable,
        new Paragraph({ spacing: { after: 100 } })
    ];
}

function buildSignatureBlock(signatureBlock) {
    const sig = signatureBlock || {};
    const stampImage = loadSignatureImage(sig.shipStampImage, "OPS-OFD-011-stamp");

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
                        children: [
                            new Paragraph({
                                spacing: { after: 80 },
                                children: [
                                    new TextRun({ text: "Master's Name:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 120 },
                                children: [
                                    new TextRun({ text: sig.masterName || "", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({ text: "Ship's stamp:", size: FONT_SIZE })
                                ]
                            }),
                            stampImage ? new Paragraph({
                                spacing: { after: 100 },
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new ImageRun({
                                        data: stampImage,
                                        transformation: { width: 150, height: 75 }
                                    })
                                ]
                            }) : new Paragraph({
                                spacing: { after: 100, before: 0 },
                                children: [
                                    new TextRun({ text: "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        children: [
                            new Paragraph({
                                spacing: { after: 80 },
                                children: [
                                    new TextRun({ text: "SS/MV:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 120 },
                                children: [
                                    new TextRun({ text: sig.vesselName || "", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 80 },
                                children: [
                                    new TextRun({ text: `Date (dd/mmm/yyyy):`, size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 120 },
                                children: [
                                    new TextRun({ text: formatDate(sig.signedDate), size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 80 },
                                children: [
                                    new TextRun({ text: "Time (HH:MM):", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { after: 120 },
                                children: [
                                    new TextRun({ text: formatTime(sig.signedTime), size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ========== MAIN EXPORT ==========

export async function generateOpsOfd011Doc(standingOrder, fullPath) {
    const specificInstructions = standingOrder.superintendentSpecificInstructions || "";
    const signatureBlock = standingOrder.signatureBlock || {};

    const totalPages = 2;

    // ========== PAGE 1 ==========
    const page1Children = [
        buildHeaderTable(standingOrder, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        // Introduction
        new Paragraph({
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: INTRODUCTION,
                    size: FONT_SIZE
                })
            ]
        }),
        // Second introductory paragraph
        new Paragraph({
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: "The following outlines the requirements of the STS Superintendent and indicates the circumstances under which he should be informed.",
                    size: FONT_SIZE
                })
            ]
        }),
        // Environment Section
        ...buildSection(ENVIRONMENT_SECTION),
        // Communications Section
        ...buildSection(COMMUNICATIONS_SECTION),
        // Emergency Situations Section
        ...buildSection(EMERGENCY_SECTION),
        // Spacer to push footer down
        new Paragraph({ spacing: { before: 600 } }),
        buildFooterLine(FORM_TITLE)
    ];

    // ========== PAGE 2 ==========
    const page2Children = [
        buildHeaderTable(standingOrder, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        // Hoses Section
        ...buildSection(HOSES_SECTION),
        // Moorings Section
        ...buildSection(MOORINGS_SECTION),
        // Fenders Section
        ...buildSection(FENDERS_SECTION),
        // Cargo Operations Section
        ...buildSection(CARGO_OPERATIONS_SECTION),
        // STS Superintendent Specific Instructions with bordered section
        new Paragraph({ spacing: { before: 200 } }),
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: makeSectionBorder(),
                bottom: makeSectionBorder(),
                left: makeSectionBorder(),
                right: makeSectionBorder(),
            },
            rows: [
                // Header row
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            margins: { top: 60, bottom: 60, left: 80, right: 80 },
                            verticalAlign: VerticalAlign.CENTER,
                            borders: {
                                top: makeSectionBorder(),
                                bottom: makeBorder(),
                                left: makeSectionBorder(),
                                right: makeSectionBorder(),
                            },
                            shading: { fill: "D3D3D3" }, // Grey background like other sections
                            children: [
                                new Paragraph({
                                    spacing: { before: 0, after: 0 },
                                    children: [
                                        new TextRun({
                                            text: "STS Superintendent Specific Instructions",
                                            bold: true,
                                            size: FONT_SIZE + 2
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                // Content row
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            margins: { top: 100, bottom: 100, left: 80, right: 80 },
                            borders: {
                                top: makeBorder(),
                                bottom: makeSectionBorder(),
                                left: makeSectionBorder(),
                                right: makeSectionBorder(),
                            },
                            children: [
                                new Paragraph({
                                    spacing: { before: 0, after: 0 },
                                    children: [
                                        new TextRun({
                                            text: specificInstructions || "",
                                            size: FONT_SIZE
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        }),
        // Signature Block
        new Paragraph({ spacing: { before: 100 } }),
        buildSignatureBlock(signatureBlock),
        // Spacer to push footer down
        new Paragraph({ spacing: { before: 200 } }),
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

// ========== FOOTER LINE ==========
function buildFooterLine(title) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: title,
                size: FONT_SIZE_SMALL,
                italics: true
            })
        ]
    });
}
