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

export async function generateOpsOfd018Doc(timesheet, fullPath) {
    const docInfo = timesheet.documentInfo || {};
    const basicInfo = timesheet.basicInfo || {};
    const operationTimings = timesheet.operationTimings || [];
    const additionalActivities = timesheet.additionalActivities || [];
    const weatherDelay = timesheet.weatherDelay || {};
    const cargoInfo = timesheet.cargoInfo || {};
    const finalRemarks = timesheet.finalRemarks || "";

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
                                        text: "TIMESHEET",
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
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-018"),
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

    /* ================= BASIC INFO SECTION ================= */

    const basicInfoRows = [
        new TableRow({
            children: [
                tableCell("STS SUPERINTENDENT:", true, 30),
                tableCell(basicInfo.stsSuperintendent || "", false, 70),
            ]
        }),
        new TableRow({
            children: [
                tableCell("JOB No.:", true, 30),
                tableCell(basicInfo.jobNumber || "", false, 70),
            ]
        }),
        new TableRow({
            children: [
                tableCell("RECEIVING VESSEL", true, 30),
                tableCell(basicInfo.receivingVessel || "", false, 70),
            ]
        }),
        new TableRow({
            children: [
                tableCell("DISCHARGING VESSEL", true, 30),
                tableCell(basicInfo.dischargingVessel || "", false, 70),
            ]
        }),
        new TableRow({
            children: [
                tableCell("SUPPORT CRAFT USED FOR MOB / DEMOB", true, 30),
                tableCell(basicInfo.supportCraftMobDemob || "", false, 70),
            ]
        }),
        new TableRow({
            children: [
                tableCell("LOCATION:", true, 30),
                tableCell(basicInfo.location || "", false, 70),
            ]
        }),
    ];

    const basicInfoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: basicInfoRows
    });

    /* ================= STS OPERATION TIMINGS TABLE ================= */

    const timingTableRows = [
        // Header row
        new TableRow({
            children: [
                tableCell("Activities", true, 30),
                tableCell("From", true, 15),
                tableCell("", true, 0), // Empty spacer
                tableCell("To", true, 15),
                tableCell("", true, 0), // Empty spacer
                tableCell("REMARKS", true, 30),
            ]
        }),
        // Sub-header row
        new TableRow({
            children: [
                tableCell("", true, 30),
                tableCell("Date", true, 7.5),
                tableCell("Time", true, 7.5),
                tableCell("Date", true, 7.5),
                tableCell("Time", true, 7.5),
                tableCell("", true, 30),
            ]
        })
    ];

    // Default activities list (14 items)
    const defaultActivities = [
        "COMM SHORE MOBILISATION",
        "SUPPORT CRAFT SAILS",
        "M/M ONBOARD",
        "COMM MOB EQUIPMENT ON VESSEL",
        "COMM RUN IN",
        "MOORING",
        "HOSES CONNECTION",
        "CARGO OPERATION",
        "HOSE DISCONNECTION",
        "FIGURES / DOCUMENTS ETC",
        "UNMOORING",
        "COMM DEMOB EQUIPMENT",
        "SUPPORT CRAFT DEPARTS VESSEL",
        "SHORE DEMOBILISATION"
    ];

    // Add data rows (minimum 14 rows)
    const rowCount = Math.max(operationTimings.length, defaultActivities.length);
    for (let i = 0; i < rowCount; i++) {
        const timing = operationTimings[i] || {};
        const activityName = timing.activityName || defaultActivities[i] || "";
        
        timingTableRows.push(
            new TableRow({
                children: [
                    tableCell(activityName, false, 30),
                    tableCell(formatDate(timing.fromDate), false, 7.5),
                    tableCell(timing.fromTime || "", false, 7.5),
                    tableCell(formatDate(timing.toDate), false, 7.5),
                    tableCell(timing.toTime || "", false, 7.5),
                    tableCell(timing.remarks || "", false, 30),
                ]
            })
        );
    }

    const timingTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: timingTableRows
    });

    /* ================= ADDITIONAL ACTIVITY TABLE ================= */

    const additionalTableRows = [
        // Header row
        new TableRow({
            children: [
                tableCell("", true, 30),
                tableCell("FROM", true, 15),
                tableCell("", true, 0),
                tableCell("TO", true, 15),
                tableCell("", true, 0),
                tableCell("REMARKS", true, 30),
            ]
        }),
        // Sub-header row
        new TableRow({
            children: [
                tableCell("", true, 30),
                tableCell("Date", true, 7.5),
                tableCell("Time", true, 7.5),
                tableCell("Date", true, 7.5),
                tableCell("Time", true, 7.5),
                tableCell("", true, 30),
            ]
        })
    ];

    // Add 4 data rows
    for (let i = 0; i < 4; i++) {
        const activity = additionalActivities[i] || {};
        additionalTableRows.push(
            new TableRow({
                children: [
                    tableCell(activity.activityName || "", false, 30),
                    tableCell(formatDate(activity.fromDate), false, 7.5),
                    tableCell(activity.fromTime || "", false, 7.5),
                    tableCell(formatDate(activity.toDate), false, 7.5),
                    tableCell(activity.toTime || "", false, 7.5),
                    tableCell(activity.remarks || "", false, 30),
                ]
            })
        );
    }

    const additionalTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: additionalTableRows
    });

    /* ================= WEATHER AND CARGO SECTION ================= */

    const weatherCargoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({
                children: [
                    // Left: Weather Delay
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: "SIGNIFICANT WEATHER WHICH CAUSED DELAY", bold: true })]
                            }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "SEA:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: weatherDelay.sea || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "SWELL:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: weatherDelay.swell || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "WIND:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: weatherDelay.wind || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "TOTAL EXPOSURE HOURS:", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: weatherDelay.totalExposureHours || "" })] }),
                        ]
                    }),
                    // Right: Cargo
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: tableBorder,
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: "CARGO", bold: true })]
                            }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "CARGO", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: cargoInfo.cargoName || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "QUANTITY", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: cargoInfo.cargoQuantity || "" })] }),
                            new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "CARGO PUMPING TIME", bold: true })] }),
                            new Paragraph({ children: [new TextRun({ text: cargoInfo.cargoPumpingTime || "" })] }),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= FINAL REMARKS SECTION ================= */

    const remarksParagraphs = [
        new Paragraph({
            spacing: { before: 200 },
            children: [
                new TextRun({
                    text: "EQUIPMENT / OPERATIONAL / INCIDENT / DELAYS ETC, REMARKS",
                    bold: true
                })
            ]
        })
    ];

    // Split finalRemarks into lines and add as paragraphs
    if (finalRemarks) {
        const lines = finalRemarks.split('\n').filter(line => line.trim());
        lines.forEach(line => {
            remarksParagraphs.push(
                new Paragraph({
                    spacing: { before: 100 },
                    children: [new TextRun({ text: line })]
                })
            );
        });
    } else {
        remarksParagraphs.push(
            new Paragraph({
                spacing: { before: 100 },
                children: [new TextRun({ text: "" })]
            })
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
                    new Paragraph({ spacing: { before: 200 } }),
                    basicInfoTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    new Paragraph({
                        children: [new TextRun({ text: "STS OPERATION TIMINGS", bold: true, size: 22 })]
                    }),
                    new Paragraph({ spacing: { before: 100 } }),
                    timingTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    new Paragraph({
                        children: [new TextRun({ text: "ADDITIONAL ACTIVITY", bold: true, size: 22 })]
                    }),
                    new Paragraph({ spacing: { before: 100 } }),
                    additionalTable,
                    new Paragraph({ spacing: { before: 200 } }),
                    weatherCargoTable,
                    ...remarksParagraphs,
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
