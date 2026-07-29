import fs from "fs";
import path from "path";
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

export async function generateOpsOfd005CDoc(checklist, fullPath) {

    const docInfo = checklist.documentInfo || {};
    const transferInfo = checklist.terminalTransferInfo || {};
    const items = checklist.checklistItems || [];
    const persons = checklist.responsiblePersons || {};

    /* ================= LOAD LOGO ================= */

    let logoImage = null;

    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    /* ================= HEADER TABLE ================= */

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [

                    /* LOGO CELL */
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        rowSpan: 2,
                        verticalAlign: "center",
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
                                : new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({ text: "OCEANE", bold: true, size: 24 })
                                    ]
                                })
                        ]
                    }),

                    /* TITLE CELL */
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        rowSpan: 2,
                        verticalAlign: "center",
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 80 },
                                children: [
                                    new TextRun({
                                        text: "AT SEA SHIP TO SHIP TRANSFER",
                                        bold: true,
                                        size: 24
                                    })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: "CHECKLIST 7 – CHECKS PRE TRANSFER CONFERENCE ALONGSIDE A TERMINAL",
                                        bold: true,
                                        size: 18
                                    })
                                ]
                            })
                        ]
                    }),

                    /* DOC INFO — Row 1 */
                    new TableCell({
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        children: [infoLine("Form No:")]
                    }),
                    new TableCell({
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        children: [infoValue(docInfo.formNo || "OPS-OFD-005C")]
                    })
                ]
            }),

            /* Doc Info rows 2-4 */
            new TableRow({
                children: [
                    new TableCell({ children: [infoLine("Rev.No.")] }),
                    new TableCell({ children: [infoValue(docInfo.revisionNo || "")] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph("")] }),
                    new TableCell({ children: [infoLine("Issue Date:")] }),
                    new TableCell({ children: [infoValue(formatDate(docInfo.issueDate))] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph("")] }),
                    new TableCell({ children: [infoLine("Approved by:")] }),
                    new TableCell({ children: [infoValue(docInfo.approvedBy || "JS")] })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ columnSpan: 2, children: [new Paragraph("")] }),
                    new TableCell({ children: [infoLine("Page:")] }),
                    new TableCell({ children: [infoValue("1 of 1")] })
                ]
            })
        ]
    });

    /* ================= SHIP / TERMINAL INFO ================= */

    const shipInfoParagraphs = [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200 }, children: [new TextRun({ text: "Terminal Berthed Ship: ", bold: true }), new TextRun(transferInfo.terminalBerthedShip || "________________________")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 100 }, children: [new TextRun({ text: "Outer Ship: ", bold: true }), new TextRun(transferInfo.outerShip || "________________________")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 100, after: 200 }, children: [new TextRun({ text: "Terminal: ", bold: true }), new TextRun(transferInfo.terminal || "________________________")] }),
    ];

    /* ================= SECTION TITLE ================= */

    const sectionTitle = new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 200, after: 200 },
        children: [
            new TextRun({
                text: "CHECKLIST 7 – CHECKS PRE TRANSFER CONFERENCE ALONGSIDE A TERMINAL",
                bold: true,
                size: 20
            })
        ]
    });

    /* ================= CHECKLIST TABLE ================= */

    const checklistTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [

            /* HEADER ROW */
            new TableRow({
                children: [
                    headerCell("", 5),
                    headerCell("Description", 35),
                    headerCell("Terminal\nBerthed Ship", 15),
                    headerCell("Outer ship", 15),
                    headerCell("Terminal", 15),
                    headerCell("Remarks", 15)
                ]
            }),

            /* DATA ROWS */
            ...items.map((item, idx) =>
                new TableRow({
                    children: [
                        dataCell(String(item.clNumber || idx + 1), 5),
                        dataCell(item.description || "", 35),
                        dataCell(item.status?.terminalBerthedShip ? "☑" : "☐", 15, true),
                        dataCell(item.status?.outerShip ? "☑" : "☐", 15, true),
                        dataCell(item.status?.terminal ? "☑" : "☐", 15, true),
                        dataCell(item.remarks || "", 15)
                    ]
                })
            )
        ]
    });

    /* ================= RESPONSIBLE PERSONS TABLE ================= */

    const personsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Officer in charge of CHS:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: `Name: ${persons.chsOfficerName || ""}` })] }),
                            new Paragraph(""),
                            new Paragraph("")
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Terminal Rep:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: `Name: ${persons.terminalRepresentativeName || ""}` })] }),
                            new Paragraph(""),
                            new Paragraph("")
                        ]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Officer in charge of MS:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: `Name: ${persons.msOfficerName || ""}` })] }),
                            new Paragraph(""),
                            new Paragraph("")
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "STS Supdt:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: `Name: ${persons.stsSuperintendentName || ""}` })] }),
                            new Paragraph(""),
                            new Paragraph("")
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= FOOTER ================= */

    const footer = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300 },
        children: [
            new TextRun({
                text: "CHECKLIST 7 – CHECKS PRE TRANSFER CONFERENCE ALONGSIDE A TERMINAL",
                bold: true,
                size: 18
            })
        ]
    });

    /* ================= ASSEMBLE DOCUMENT ================= */

    const doc = new Document({
        sections: [
            {
                children: [
                    headerTable,
                    ...shipInfoParagraphs,
                    sectionTitle,
                    checklistTable,
                    new Paragraph(""),
                    personsTable,
                    footer
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}


/* ===================== HELPERS ===================== */

function infoLine(label) {
    return new Paragraph({
        children: [
            new TextRun({ text: label, bold: true, size: 18 })
        ]
    });
}

function infoValue(value) {
    return new Paragraph({
        children: [
            new TextRun({ text: value || "", size: 18 })
        ]
    });
}

function headerCell(text, widthPct) {
    return new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        shading: { fill: "4472C4" },
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: text || "",
                        bold: true,
                        color: "FFFFFF",
                        size: 18
                    })
                ]
            })
        ]
    });
}

function dataCell(text, widthPct, center = false) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [
                    new TextRun({
                        text: textValue,
                        size: 18
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
