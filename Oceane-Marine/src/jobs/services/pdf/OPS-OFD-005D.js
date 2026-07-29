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
    ImageRun
} from "docx";

export async function generateOpsOfd005DDoc(checklist, fullPath) {

    const checklistItems = checklist.checklistItems || [];
    const terminalBerthedShipSig = checklist.terminalBerthedShipSignature || {};
    const outerShipSig = checklist.outerShipSignature || {};
    const terminalSig = checklist.terminalSignature || {};

    /* ================= LOAD IMAGES ================= */

    let logoImage = null;
    let terminalBerthedShipSignatureImage = null;
    let outerShipSignatureImage = null;
    let terminalSignatureImage = null;

    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    terminalBerthedShipSignatureImage = loadSignatureImage(terminalBerthedShipSig?.signature, "OPS-OFD-005D-terminalBerthedShip");
    outerShipSignatureImage = loadSignatureImage(outerShipSig?.signature, "OPS-OFD-005D-outerShip");
    terminalSignatureImage = loadSignatureImage(terminalSig?.signature, "OPS-OFD-005D-terminal");

    /* ================= HEADER TABLE ================= */

    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [

                    /* LOGO CELL */
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                            logoImage
                                ? new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: logoImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph("OCEANE GROUP")
                        ]
                    }),

                    /* TITLE CELL */
                    new TableCell({
                        width: { size: 40, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: "AT SEA SHIP TO SHIP TRANSFER",
                                        bold: true,
                                        size: 28
                                    })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: "STS Transfer Safety Checklist",
                                        bold: true,
                                        size: 22
                                    })
                                ]
                            })
                        ]
                    }),

                    /* DOC INFO CELL */
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        children: [
                            infoLine("Form No", checklist.formNo || "OPS-OFD-005D"),
                            infoLine("Rev. No.", checklist.revisionNo),
                            infoLine("Issue Date", formatDate(checklist.revisionDate)),
                            infoLine("Approved by", checklist.approvedBy || "JS"),
                            infoLine("Page", checklist.page || "1 of 1")
                        ]
                    })

                ]
            })
        ]
    });

    /* ================= INITIAL INPUT FIELDS ================= */

    const initialFieldsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    tableCell("Terminal Berthed Ship:", true),
                    tableCell(checklist.terminalBerthedShip || "________________________")
                ]
            }),
            new TableRow({
                children: [
                    tableCell("Outer ship:", true),
                    tableCell(checklist.outerShip || "________________________")
                ]
            }),
            new TableRow({
                children: [
                    tableCell("Terminal:", true),
                    tableCell(checklist.terminal || "________________________")
                ]
            })
        ]
    });

    /* ================= DECLARATION SECTION ================= */

    const declarationParagraph = new Paragraph({
        children: [
            new TextRun({
                text: "Declaration for STS operations (At port & Terminal)",
                bold: true,
                size: 24
            })
        ]
    });

    const declarationText = new Paragraph({
        children: [
            new TextRun({
                text: "The undersigned have checked and agreed the Applicable checklist questions and confirm in the declarations below."
            })
        ]
    });

    /* ================= CHECKLIST TABLE ================= */

    const checklistTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    tableCell("Checklist", true),
                    tableCell("Description", true),
                    tableCell("Terminal Berthed ship", true),
                    tableCell("Outer ship", true),
                    tableCell("Terminal", true),
                    tableCell("Not Applicable", true)
                ]
            }),
            ...checklistItems.map(item =>
                new TableRow({
                    children: [
                        tableCell(item.checklist || ""),
                        tableCell(item.description || ""),
                        tableCell(item.terminalBerthedShip ? "✓" : ""),
                        tableCell(item.outerShip ? "✓" : ""),
                        tableCell(item.terminal ? "✓" : ""),
                        tableCell(item.notApplicable ? "✓" : "")
                    ]
                })
            )
        ]
    });

    /* ================= CONCLUDING TEXT ================= */

    const concludingText1 = new Paragraph({
        children: [
            new TextRun({
                text: "In Accordance with the Guidance in the STS transfer Guide, The Entries we have made are correct to the best of our knowledge and that the ships agree to perform the STS operation."
            })
        ]
    });

    const concludingText2 = new Paragraph({
        children: [
            new TextRun({
                text: `Repetitive Checks noted in Checklist 5B of the transfer Guide, shall be carried out at intervals of not more than ${checklist.repetitiveChecksInterval || "...................................."} Hours.`
            })
        ]
    });

    const concludingText3 = new Paragraph({
        children: [
            new TextRun({
                text: "If the status of any item changes, the other ship should be notified immediately.",
                bold: true
            })
        ]
    });

    /* ================= SIGNATURE TABLE ================= */

    const signatureTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            // Header row
            new TableRow({
                children: [
                    tableCell("Terminal Berthed Ship", true),
                    tableCell("Outer Ship", true),
                    tableCell("Terminal", true)
                ]
            }),
            // Name row
            new TableRow({
                children: [
                    tableCell(`Name: ${terminalBerthedShipSig.name || ""}`),
                    tableCell(`Name: ${outerShipSig.name || ""}`),
                    tableCell(`Name: ${terminalSig.name || ""}`)
                ]
            }),
            // Rank row
            new TableRow({
                children: [
                    tableCell(`Rank: ${terminalBerthedShipSig.rank || ""}`),
                    tableCell(`Rank: ${outerShipSig.rank || ""}`),
                    tableCell(`Rank: ${terminalSig.rank || ""}`)
                ]
            }),
            // Signature row
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            terminalBerthedShipSignatureImage
                                ? new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: terminalBerthedShipSignatureImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph("Signature")
                        ]
                    }),
                    new TableCell({
                        children: [
                            outerShipSignatureImage
                                ? new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: outerShipSignatureImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph("Signature")
                        ]
                    }),
                    new TableCell({
                        children: [
                            terminalSignatureImage
                                ? new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: terminalSignatureImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph("Signature")
                        ]
                    })
                ]
            }),
            // Date row
            new TableRow({
                children: [
                    tableCell(`Date: ${formatDate(terminalBerthedShipSig.date)}`),
                    tableCell(`Date: ${formatDate(outerShipSig.date)}`),
                    tableCell(`Date: ${formatDate(terminalSig.date)}`)
                ]
            }),
            // Time row
            new TableRow({
                children: [
                    tableCell(`Time: ${terminalBerthedShipSig.time || ""}`),
                    tableCell(`Time: ${outerShipSig.time || ""}`),
                    tableCell(`Time: ${terminalSig.time || ""}`)
                ]
            })
        ]
    });

    /* ================= DOC ================= */

    const doc = new Document({
        sections: [
            {
                children: [
                    headerTable,
                    new Paragraph(""),
                    initialFieldsTable,
                    new Paragraph(""),
                    declarationParagraph,
                    declarationText,
                    new Paragraph(""),
                    checklistTable,
                    new Paragraph(""),
                    concludingText1,
                    concludingText2,
                    concludingText3,
                    new Paragraph(""),
                    signatureTable
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}


/* HELPERS */
function infoLine(label, value) {
    return new Paragraph({
        children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun(value || "")
        ]
    });
}

function tableCell(text, bold = false) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
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
