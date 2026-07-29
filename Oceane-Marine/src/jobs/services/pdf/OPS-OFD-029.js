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

export async function generateOpsOfd029Doc(expenseSheet, fullPath) {
    const docInfo = expenseSheet.documentInfo || {};
    const personal = expenseSheet.personalDetails || {};
    const bank = expenseSheet.bankDetails || {};
    const travel = expenseSheet.travelDetails || {};
    const expenses = expenseSheet.statementOfExpenses || [];
    const totals = expenseSheet.totals || {};

    /* ================= LOAD LOGO ================= */

    let logoImage = null;
    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

    /* ================= BORDER DEFINITIONS ================= */

    const noBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    };

    const tableBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    };

    const headerBg = "B8CCE4"; // Light blue background for section headers

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
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        verticalAlign: "center",
                        borders: noBorder,
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 100 },
                                children: [
                                    new TextRun({
                                        text: "Mooring Master Expense Sheet",
                                        bold: true,
                                        size: 28
                                    })
                                ]
                            })
                        ]
                    }),

                    /* DOC INFO CELL */
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        children: [
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-029"),
                            docInfoRow("Rev.No.", docInfo.revisionNo || ""),
                            docInfoRow("Issue Date:", formatDate(docInfo.issueDate)),
                            docInfoRow("Approved by:", docInfo.approvedBy || "JS"),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= COMPANY INFO ================= */

    const companyInfo = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: noBorder,
                        children: [
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "OCEANE FENDERS DMCC", bold: true, size: 22 })] }),
                            new Paragraph({ children: [new TextRun({ text: "1201, Fortune Tower", italics: true, size: 18 })] }),
                            new Paragraph({ children: [new TextRun({ text: "Cluster C, JLT, Dubai", italics: true, size: 18 })] }),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= PERSONAL DETAILS SECTION ================= */

    const personalDetailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            // Section header
            sectionHeaderRow("Personal Details", headerBg),
            labelValueRow("Name:", personal.name || ""),
            labelValueRow("Country:", personal.country || ""),
            labelValueRow("Date of Invoice:", formatDate(personal.invoiceDate)),
            labelValueRow("Job Number:", personal.jobNumber || ""),
            labelValueRow("Location of Operation:", personal.operationLocation || ""),
        ]
    });

    /* ================= BANK DETAILS SECTION ================= */

    const bankDetailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            sectionHeaderRow("Bank Details:", headerBg),
            labelValueRow("Name of Account Holder", bank.accountHolderName || ""),
            labelValueRow("Account Number", bank.accountNumber || ""),
            labelValueRow("SORT Code / IBAN Number", bank.ibanOrSortCode || ""),
            labelValueRow("Currency of Invoice", bank.invoiceCurrency || ""),
        ]
    });

    /* ================= EXPENSE DETAILS (TRAVEL) ================= */

    const departure = travel.departureFromHomeTown || {};
    const arrival = travel.arrivalAtHomeTown || {};

    const expenseDetailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            // Header
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 40, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        shading: { fill: headerBg },
                        children: [boldPara("Expense Details")]
                    }),
                    new TableCell({
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        shading: { fill: headerBg },
                        children: [boldPara("Date")]
                    }),
                    new TableCell({
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        shading: { fill: headerBg },
                        children: [boldPara("Time")]
                    }),
                    new TableCell({
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        shading: { fill: headerBg },
                        children: [boldPara("Remarks")]
                    }),
                ]
            }),
            // Departure row
            new TableRow({
                children: [
                    tableCell("Date of departure from home town", false, 40),
                    tableCell(formatDate(departure.date), false, 20),
                    tableCell(departure.time || "", false, 20),
                    tableCell(departure.remarks || "", false, 20),
                ]
            }),
            // Arrival row
            new TableRow({
                children: [
                    tableCell("Date of arrival at home town", false, 40),
                    tableCell(formatDate(arrival.date), false, 20),
                    tableCell(arrival.time || "", false, 20),
                    tableCell(arrival.remarks || "", false, 20),
                ]
            }),
        ]
    });

    /* ================= STATEMENT OF EXPENSES TABLE ================= */

    const expenseTableRows = [
        // Header
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("Statement of Expenses")]
                }),
                new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("No.of days / Misc")]
                }),
                new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("Daily Rate")]
                }),
                new TableCell({
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("Amount")]
                }),
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [
                        boldPara("Total (in Dirhams)"),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: "For Office Use", italics: true, size: 16 })]
                        })
                    ]
                }),
            ]
        })
    ];

    // Data rows — minimum 10 rows
    const minExpenseRows = 10;
    const expenseRowCount = Math.max(expenses.length, minExpenseRows);
    for (let i = 0; i < expenseRowCount; i++) {
        const exp = expenses[i] || {};
        expenseTableRows.push(
            new TableRow({
                children: [
                    tableCell(exp.description || "", false, 30),
                    tableCell(exp.numberOfDaysOrMisc || "", false, 15),
                    tableCell(formatNumber(exp.dailyRate), false, 15),
                    tableCell(formatNumber(exp.amount), false, 15),
                    tableCell(formatNumber(exp.officeTotal), false, 25),
                ]
            })
        );
    }

    // Sub Total row
    expenseTableRows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 3,
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("Sub Total")]
                }),
                tableCell(formatNumber(totals.subTotal), false, 15),
                tableCell(formatNumber(totals.subTotal), false, 25),
            ]
        })
    );

    // VAT row
    expenseTableRows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 3,
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("VAT (if applicable)")]
                }),
                tableCell(formatNumber(totals.vatAmount), false, 15),
                tableCell(formatNumber(totals.vatAmount), false, 25),
            ]
        })
    );

    // Grand Total row
    expenseTableRows.push(
        new TableRow({
            children: [
                new TableCell({
                    columnSpan: 3,
                    borders: tableBorder,
                    shading: { fill: headerBg },
                    children: [boldPara("Grand Total")]
                }),
                tableCell("", false, 15),
                new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: tableBorder,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [new TextRun({ text: formatNumber(totals.grandTotal), bold: true })]
                        })
                    ]
                }),
            ]
        })
    );

    const expenseTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: expenseTableRows,
    });

    /* ================= FOOTER NOTE ================= */

    const footerNote = new Paragraph({
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: "All Expenses of whatsoever must be supported by a valid receipt.",
                italics: true,
                color: "FF0000",
                size: 18
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
                    companyInfo,
                    new Paragraph({ spacing: { before: 200 } }),
                    personalDetailsTable,
                    new Paragraph({ spacing: { before: 100 } }),
                    bankDetailsTable,
                    new Paragraph({ spacing: { before: 100 } }),
                    expenseDetailsTable,
                    new Paragraph({ spacing: { before: 100 } }),
                    expenseTable,
                    footerNote,
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

function boldPara(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 18 })]
    });
}

function sectionHeaderRow(text, bgColor) {
    return new TableRow({
        children: [
            new TableCell({
                columnSpan: 2,
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                },
                shading: { fill: bgColor },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text, bold: true, size: 18 })]
                    })
                ]
            })
        ]
    });
}

function labelValueRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: label, bold: true, size: 18 })]
                    })
                ]
            }),
            new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: String(value || ""), size: 18 })]
                    })
                ]
            }),
        ]
    });
}

function tableCell(text, bold = false, widthPercent = null) {
    const textValue = text !== null && text !== undefined ? String(text) : "";
    return new TableCell({
        width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
        children: [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: textValue,
                        bold,
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

function formatNumber(num) {
    if (num === null || num === undefined || num === "") return "0.00";
    const n = Number(num);
    if (isNaN(n)) return "0.00";
    return n.toFixed(2);
}
