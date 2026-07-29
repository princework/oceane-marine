import fs from "fs";
import path from "path";
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
    BorderStyle
} from "docx";

export async function generateOpsOfd014Doc(checklist, fullPath) {
    const docInfo = checklist.documentInfo || {};
    const jobInfo = checklist.jobInfo || {};
    const fenderEquipment = checklist.fenderEquipment || [];
    const hoseEquipment = checklist.hoseEquipment || [];
    const otherEquipment = checklist.otherEquipment || [];
    const sig = checklist.signatureBlock || {};

    /* ================= LOAD IMAGES ================= */

    let logoImage = null;
    let signatureImage = null;

    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    signatureImage = loadSignatureImage(sig.mooringMasterSignature, "OPS-OFD-014");

    /* ================= HEADER TABLE ================= */

    const noBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    };

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    /* LOGO CELL */
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        verticalAlign: "center",
                        borders: noBorder,
                        children: [
                            logoImage
                                ? new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new ImageRun({
                                            data: logoImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "OCEANE", bold: true })] })
                        ]
                    }),

                    /* TITLE CELL */
                    new TableCell({
                        width: { size: 40, type: WidthType.PERCENTAGE },
                        verticalAlign: "center",
                        borders: noBorder,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({
                                        text: "STS Equipment Checklist",
                                        bold: true,
                                        size: 28
                                    })
                                ]
                            })
                        ]
                    }),

                    /* DOC INFO CELL */
                    new TableCell({
                        width: { size: 35, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        children: [
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-014"),
                            docInfoRow("Rev.No.", docInfo.revisionNo || ""),
                            docInfoRow("Issue Date:", formatDate(docInfo.issueDate)),
                            docInfoRow("Approved by:", docInfo.approvedBy || "JS"),
                            docInfoRow("Page:", docInfo.page || "1 of 1"),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= OPERATION STATUS ================= */

    const operationPhase = jobInfo.operationPhase || "";
    const beforeOp = operationPhase === "BEFORE_OPERATION" ? "✓" : "";
    const afterOp = operationPhase === "AFTER_OPERATION" ? "✓" : "";

    const operationStatusParagraph = new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
            new TextRun({ text: "Before Operation ", bold: true, size: 20 }),
            new TextRun({ text: beforeOp, size: 20 }),
            new TextRun({ text: "        After Operation ", bold: true, size: 20 }),
            new TextRun({ text: afterOp, size: 20 }),
        ]
    });

    /* ================= JOB AND MOORING DETAILS ================= */

    const jobDetailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Date:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: formatDate(jobInfo.date) })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Time:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: jobInfo.time || "" })] }),
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Mooring Master:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: jobInfo.mooringMasterName || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Location", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: jobInfo.location || "" })] }),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= FENDER EQUIPMENT TABLE ================= */

    const fenderTableRows = [
        new TableRow({
            children: [
                tableCell("Fender ID #", true),
                tableCell("End Plates", true),
                tableCell("B. Shackle", true),
                tableCell("Swivel", true),
                tableCell("2nd Shackle", true),
                tableCell("Mooring Shackle", true),
                tableCell("Fender Body", true),
                tableCell("Tires", true),
                tableCell("Pressure", true),
            ]
        })
    ];

    // Add rows based on actual data length (minimum 10 rows, or actual length if more)
    const fenderRowCount = Math.max(fenderEquipment.length, 10);
    for (let i = 0; i < fenderRowCount; i++) {
        const row = fenderEquipment[i] || {};
        fenderTableRows.push(
            new TableRow({
                children: [
                    tableCell(row.fenderId || ""),
                    tableCell(row.endPlates || ""),
                    tableCell(row.bShackle || ""),
                    tableCell(row.swivel || ""),
                    tableCell(row.secondShackle || ""),
                    tableCell(row.mooringShackle || ""),
                    tableCell(row.fenderBody || ""),
                    tableCell(row.tires || ""),
                    tableCell(row.pressure || ""),
                ]
            })
        );
    }

    const fenderTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: fenderTableRows
    });

    /* ================= HOSE EQUIPMENT TABLE ================= */

    const hoseTableRows = [
        new TableRow({
            children: [
                tableCell("Hose ID #", true),
                tableCell("End Flanges", true),
                tableCell("Body Condition", true),
                tableCell("Nuts/Bolts", true),
                tableCell("Markings", true),
            ]
        })
    ];

    // Add rows based on actual data length (minimum 5 rows, or actual length if more)
    const hoseRowCount = Math.max(hoseEquipment.length, 5);
    for (let i = 0; i < hoseRowCount; i++) {
        const row = hoseEquipment[i] || {};
        hoseTableRows.push(
            new TableRow({
                children: [
                    tableCell(row.hoseId || ""),
                    tableCell(row.endFlanges || ""),
                    tableCell(row.bodyCondition || ""),
                    tableCell(row.nutsBolts || ""),
                    tableCell(row.markings || ""),
                ]
            })
        );
    }

    const hoseTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: hoseTableRows
    });

    /* ================= OTHER EQUIPMENT TABLE ================= */

    const otherTableRows = [
        new TableRow({
            children: [
                tableCell("Other Equipment ID #", true),
                tableCell("Gaskets", true),
                tableCell("Ropes", true),
                tableCell("Wires", true),
                tableCell("Billy Pugh", true),
                tableCell("Lifting Stopes", true),
            ]
        })
    ];

    // Add rows based on actual data length (minimum 5 rows, or actual length if more)
    const otherRowCount = Math.max(otherEquipment.length, 5);
    for (let i = 0; i < otherRowCount; i++) {
        const row = otherEquipment[i] || {};
        otherTableRows.push(
            new TableRow({
                children: [
                    tableCell(row.equipmentId || ""),
                    tableCell(row.gaskets || ""),
                    tableCell(row.ropes || ""),
                    tableCell(row.wires || ""),
                    tableCell(row.billyPugh || ""),
                    tableCell(row.liftingStrops || ""),
                ]
            })
        );
    }

    const otherTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: otherTableRows
    });

    /* ================= SIGNATURE AND REMARKS ================= */

    const signatureRemarksTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            signatureImage
                                ? new Paragraph({
                                    spacing: { before: 100, after: 100 },
                                    children: [
                                        new ImageRun({
                                            data: signatureImage,
                                            transformation: { width: 200, height: 80 }
                                        })
                                    ]
                                })
                                : new Paragraph({ spacing: { before: 100, after: 100 }, children: [new TextRun({ text: "" })] }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: "Signature of Mooring Master", bold: true, size: 18 })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: "Remarks:", bold: true, size: 18 })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100, after: 100 },
                                children: [
                                    new TextRun({ text: checklist.remarks || "", size: 18 })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= ASSEMBLE DOCUMENT ================= */

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 720,
                            right: 720,
                            bottom: 720,
                            left: 720,
                        }
                    }
                },
                children: [
                    headerTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    operationStatusParagraph,
                    new Paragraph({ spacing: { before: 200 } }),
                    jobDetailsTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    fenderTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    hoseTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    otherTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    signatureRemarksTable,
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

/* ================= HELPERS ================= */

const tableBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function docInfoRow(label, value) {
    return new Paragraph({
        spacing: { after: 20 },
        children: [
            new TextRun({ text: label, bold: true, size: 18 }),
            new TextRun({ text: `  ${value || ""}`, size: 18 }),
        ]
    });
}

function tableCell(text, bold = false) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
        borders: tableBorder,
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text: textValue,
                        bold
                    })
                ]
            })
        ]
    });
}

function formatDate(date) {
    if (!date) return "";
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    } catch (e) {
        return "";
    }
}
