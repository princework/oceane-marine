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
    ImageRun
} from "docx";
import { loadSignatureImage } from "./shared/loadSignatureImage.js";

export async function generateOpsOfd001Doc(checklist, fullPath) {

    const vessel = checklist.vesselDetails || {};
    const checks = checklist.genericChecks || [];
    const sig = checklist.signatureBlock || {};

    /* ================= LOAD IMAGES ================= */

    let logoImage = null;
    let signatureImage = null;

    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    signatureImage = loadSignatureImage(sig.signature, "OPS-OFD-001");

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
                                : new Paragraph("OCEANE")
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
                                        text: "CHECKLIST 1 – BEFORE OPERATION COMMENCE",
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
                            infoLine("Form No", checklist.formNo),
                            infoLine("Rev No", checklist.revisionNo),
                            infoLine("Rev Date", formatDate(checklist.revisionDate)),
                            infoLine("Approved By", checklist.approvedBy),
                            infoLine("Page", checklist.page || "1 of 2")
                        ]
                    })

                ]
            })
        ]
    });

    /* ================= VESSEL TABLE ================= */

    const vesselTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: vesselRows([
            ["Vessel Name", vessel.vesselName],
            ["Ship Operator", vessel.shipOperator],
            ["Charterer", vessel.charterer],
            ["STS Organizer", vessel.stsOrganizer],
            ["Planned Transfer Date", formatDate(vessel.plannedTransferDateTime)],
            ["Transfer Location", vessel.transferLocation],
            ["Cargo", vessel.cargo],
            ["Constant Heading Ship", vessel.constantHeadingOrBerthedShip],
            ["Manoeuvring Ship", vessel.manoeuvringOrOuterShip],
            ["POAC / STS Superintendent", vessel.poacOrStsSuperintendent],
            ["Applicable Joint Plan Operation", vessel.applicableJointPlanOperation]
        ])
    });

    /* ================= CHECKLIST TABLE ================= */

    const checklistTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [

            new TableRow({
                children: [
                    tableCell("CL", true),
                    tableCell("Generic Checks", true),
                    tableCell("Status", true),
                    tableCell("Remarks", true)
                ]
            }),

            ...checks.map(c =>
                new TableRow({
                    children: [
                        tableCell(c.clNumber),
                        tableCell(c.description),
                        tableCell(c.status),
                        tableCell(c.remarks)
                    ]
                })
            )
        ]
    });

    /* ================= SIGNATURE TABLE ================= */

    const signatureTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [

                    new TableCell({
                        children: [
                            new Paragraph(`Name: ${sig.name || ""}`),
                            new Paragraph(`Rank: ${sig.rank || ""}`)
                        ]
                    }),

                    new TableCell({
                        children: [
                            new Paragraph(`Date: ${formatDate(sig.date)}`)
                        ]
                    }),

                    new TableCell({
                        children: [
                            signatureImage
                                ? new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: signatureImage,
                                            transformation: { width: 200, height: 100 }
                                        })
                                    ]
                                })
                                : new Paragraph("Signature")
                        ]
                    })

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
                    vesselTable,
                    new Paragraph(""),
                    checklistTable,
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

function vesselRows(rows) {
    return rows.map(([label, value]) =>
        new TableRow({
            children: [
                tableCell(label, true),
                tableCell(value || "________________________")
            ]
        })
    );
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
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (e) {
        return "";
    }
}
