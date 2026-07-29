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
    BorderStyle,
    TabStopPosition,
    TabStopType
} from "docx";

/* ================= STATIC LEGAL TEXT ================= */

const INTRO_PARA_1 = `All the applicable but not limited to standard indemnity terms and conditions with which OCEANE FENDERS DMCC ("OFD") provides STS Transfer Services to any vessel, are prescribed hereunder and master of each vessel by signing a letter for himself and on behalf of Owners, Operators, Ship Managers and Demise Charterers (if any) of the vessel, agree to these T&C for the intended STS Transfer.`;

const INTRO_PARA_2 = `If for operational reasons the standard indemnity terms and conditions is not, or cannot be signed by the Master, then the Master by accepting the STS Transfer Services, nonetheless agrees by conduct to the terms and conditions on behalf of those persons stated in paragraph 1 as fully as if the terms and conditions had been signed.`;

const CLAUSE_1 = `The Master signs for himself and for and on behalf of the Owners, Operators, Ship Managers, and Demise Charterers (if any) of the said vessel, who are all bound by these terms and conditions. OFD is or shall be deemed to be acting on behalf of and for the benefit of all.`;

const CLAUSE_2 = `The Mooring Master will be acting only in an advisory role and therefore does not supersede the Master in the command of the vessel but acts as his adviser so that the management and/or command and/or navigation of the vessel will always remain with the Master and/or crew of the vessel. The Mooring Master will be deemed to be an employee and a servant of those persons stated in paragraph 1, who shall always be liable for the Mooring master's acts, neglect or default in the course of his employment. In all circumstances Master of the concerned vessel shall remain solely responsible on behalf of persons as stated in Para 1.`;

const CLAUSE_3 = `The presence of POAC shall not relieve the master of his responsibility as stated in Para 2 above. Neither OFD nor the POAC or any other person employed or engaged by OFD in connection with the performance of STS Transfer service shall be liable for any loss, detention, delay, mis-delivery, damage, personal injury or death, howsoever, whatsoever, and where so ever caused and of what kind whether or not such loss, detention, delay, mis-delivery, damage, death or personal injury is the result of any act, neglect or default of OFD or its servants or of others for whom it may be responsible.`;

const CLAUSE_4 = `If OFD and/or the Mooring Master should be held liable by a third party for any loss or damage of whatsoever nature or for any loss of life or personal injury to, and or illness of any person, or for any pollution of whatsoever nature, howsoever caused, the Owners, Operators, Ship Managers, and Demise Charterers (if any) shall jointly and severally fully indemnify OFD, POAC and/or the Mooring Master against all costs, charges, claims, expenses, fines and penalties; which OFD, POAC and/or Mooring Master may be liable to pay pursuant to aforesaid third party claims.`;

const CLAUSE_5 = `No liability shall be attached to OFD, POAC or the Mooring Master, if once on-board, the Mooring Master is unable for any reason whatsoever to perform the duties of a Mooring Master.`;

const CLAUSE_6 = `These conditions shall be construed according to English law and any disputes arising with respect to or in connection with this agreement shall be finally decided in London by one arbitrator in accordance with the Rules of Arbitration of the International Chamber of Commerce. The decision of the arbitrator shall be final and without appeal to the courts, and may be entered and enforced in any court of competent jurisdiction.`;

const DECLARATION = `I HEREBY REQUEST THE SERVICES OF OCEANE FENDERS DMCC AND I HEREBY ACKNOWLEDGE RECEIPT OF A COPY OF THE CONDITIONS OF USE OF A MOORING MASTER SUPPLIED BY OCEANE FENDERS DMCC.`;

/* ================= MAIN EXPORT ================= */

export async function generateOpsOfd028Doc(checklist, fullPath) {
    const docInfo = checklist.documentInfo || {};
    const sig = checklist.signatureBlock || {};

    /* ================= LOAD IMAGES ================= */

    let logoImage = null;
    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    const signatureImage = loadSignatureImage(sig.signatureImage, "OPS-OFD-028-signature");
    const stampImage = loadSignatureImage(sig.stampImage, "OPS-OFD-028-stamp");

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
                                        text: "Personnel Transfer Basket Checklist",
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
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-028"),
                            docInfoRow("Rev.No.", docInfo.revisionNo || ""),
                            docInfoRow("Rev Date:", formatDate(docInfo.revisionDate)),
                            docInfoRow("Approved by:", docInfo.approvedBy || "JS"),
                            docInfoRow("Page:", "1 of 1"),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= JOB REF ================= */

    const jobRefParagraph = new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
            new TextRun({ text: "Job Ref: ", bold: true, size: 20 }),
            new TextRun({ text: checklist.jobReference || "", size: 20 }),
        ]
    });

    /* ================= TITLE ================= */

    const titleParagraph = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
            new TextRun({
                text: "STANDARD INDEMNITY TERMS AND CONDITIONS",
                bold: true,
                size: 24,
                underline: {}
            })
        ]
    });

    /* ================= STATIC LEGAL PARAGRAPHS ================= */

    const legalParagraphs = [
        textParagraph(INTRO_PARA_1),
        textParagraph(INTRO_PARA_2),
        numberedClause("1.", CLAUSE_1),
        numberedClause("2.", CLAUSE_2),
        numberedClause("3.", CLAUSE_3),
        numberedClause("4.", CLAUSE_4),
        numberedClause("5.", CLAUSE_5),
        numberedClause("6.", CLAUSE_6),
    ];

    /* ================= DECLARATION ================= */

    const declarationParagraph = new Paragraph({
        spacing: { before: 300, after: 200 },
        children: [
            new TextRun({
                text: DECLARATION,
                bold: true,
                italics: true,
                size: 20
            })
        ]
    });

    /* ================= MASTER / VESSEL / DATE / TIME ================= */

    const masterLine = new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [
            new TextRun({ text: "MASTER: ", bold: true, size: 22 }),
            new TextRun({ text: checklist.masterName || "________________________", size: 22 }),
            new TextRun({ text: "                    SS/MV ", bold: true, size: 22 }),
            new TextRun({ text: checklist.vesselName || "________________________", size: 22 }),
        ]
    });

    const signedDateStr = formatDate(checklist.signedDate) || "01-Jan-2024";
    const signedTimeStr = checklist.signedTime || "______";
    const tzLabel = checklist.timeZoneLabel || "LT";

    const dateLine = new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
            new TextRun({ text: "DATE: ", bold: true, size: 22 }),
            new TextRun({ text: signedDateStr, size: 22 }),
            new TextRun({ text: "  / Time (HH:MM): ", bold: true, size: 22 }),
            new TextRun({ text: signedTimeStr, size: 22 }),
            new TextRun({ text: `        ${tzLabel}`, bold: true, size: 22 }),
        ]
    });

    /* ================= SIGNATURE IMAGE ================= */

    const signatureParagraphs = [];
    if (signatureImage) {
        signatureParagraphs.push(
            new Paragraph({
                spacing: { before: 100 },
                children: [
                    new ImageRun({
                        data: signatureImage,
                        transformation: { width: 200, height: 80 }
                    })
                ]
            })
        );
    } else {
        signatureParagraphs.push(
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "", size: 20 })] })
        );
    }

    /* ================= STAMP ================= */

    const stampParagraphs = [
        new Paragraph({
            spacing: { before: 200 },
            children: [
                new TextRun({ text: "STAMP:", bold: true, size: 22 }),
            ]
        })
    ];

    if (stampImage) {
        stampParagraphs.push(
            new Paragraph({
                spacing: { before: 100 },
                children: [
                    new ImageRun({
                        data: stampImage,
                        transformation: { width: 200, height: 80 }
                    })
                ]
            })
        );
    } else {
        stampParagraphs.push(
            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "", size: 20 })] })
        );
    }

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
                    jobRefParagraph,
                    titleParagraph,
                    ...legalParagraphs,
                    declarationParagraph,
                    masterLine,
                    dateLine,
                    ...signatureParagraphs,
                    ...stampParagraphs,
                ]
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

/* ================= HELPERS ================= */

function docInfoRow(label, value) {
    return new Paragraph({
        spacing: { after: 20 },
        children: [
            new TextRun({ text: label, bold: true, size: 18 }),
            new TextRun({ text: `  ${value || ""}`, size: 18 }),
        ]
    });
}

function textParagraph(text) {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
            new TextRun({ text, size: 20 })
        ]
    });
}

function numberedClause(number, text) {
    return new Paragraph({
        spacing: { before: 100, after: 100 },
        indent: { left: 360 },
        children: [
            new TextRun({ text: `${number}    `, bold: true, size: 20 }),
            new TextRun({ text, size: 20 })
        ]
    });
}

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
