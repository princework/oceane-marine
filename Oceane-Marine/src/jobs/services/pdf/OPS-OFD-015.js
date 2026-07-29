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

export async function generateOpsOfd015Doc(log, fullPath) {
    const docInfo = log.documentInfo || {};
    const transferInfo = log.transferInfo || {};
    const hourlyRecords = log.hourlyRecords || [];

    /* ================= LOAD LOGO ================= */

    let logoImage = null;
    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    /* ================= BORDER DEFINITIONS ================= */

    const noBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    };

    const tableBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    };

    /* ================= HEADER TABLE ================= */

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
                                        text: "HOURLY CHECKS ON THE DISCHARGED AND RECEIVED QUANTITIES",
                                        bold: true,
                                        size: 24
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
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-015"),
                            docInfoRow("Rev.No.", docInfo.revisionNo || ""),
                            docInfoRow("Issue Date:", formatDate(docInfo.issueDate)),
                            docInfoRow("Approved by:", docInfo.approvedBy || "JS"),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= TRANSFER INFO TABLE ================= */

    const transferInfoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Discharging Ship's Name:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: transferInfo.dischargingShipName || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Date of commencement of Transfer:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: formatDate(transferInfo.transferStartDate) })] }),
                        ]
                    }),
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({ children: [new TextRun({ text: "Receiving Ship's Name:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: transferInfo.receivingShipName || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Job No.:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: transferInfo.jobNumber || "" })] }),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= HOURLY RECORDS TABLE ================= */

    const hourlyTableRows = [
        // Header row
        new TableRow({
            children: [
                tableCell("Sr.No.", true),
                tableCell("Date", true),
                tableCell("Time", true),
                tableCell("Discharged Qty\n(barrels / M3 / Lts. / MT)", true),
                tableCell("Received Qty\n(barrels / M3 / Lts. / MT)", true),
                tableCell("Difference\n(barrels / M3 / Lts. / MT)", true),
                tableCell("Checked by (sign)", true),
            ]
        })
    ];

    // Add rows based on actual data length (minimum 10 rows, or actual length if more)
    const rowCount = Math.max(hourlyRecords.length, 10);
    for (let i = 0; i < rowCount; i++) {
        const record = hourlyRecords[i] || {};
        hourlyTableRows.push(
            new TableRow({
                children: [
                    tableCell(record.serialNumber || (i + 1)),
                    tableCell(formatDate(record.date)),
                    tableCell(record.time || ""),
                    tableCell(record.dischargedQuantity || ""),
                    tableCell(record.receivedQuantity || ""),
                    tableCell(record.differenceQuantity || ""),
                    tableCell(record.checkedBy || ""),
                ]
            })
        );
    }

    const hourlyTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: hourlyTableRows
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
                    transferInfoTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    hourlyTable,
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

function tableCell(text, bold = false) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
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
