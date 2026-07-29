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

export async function generateOpsOfd009Doc(report, fullPath) {
    const docInfo = report.documentInfo || {};
    const stbl = report.shipToBeLighted || {};
    const receiving = report.receivingShip || {};

    /* ================= LOAD LOGO ================= */

    let logoImage = null;
    try {
        logoImage = fs.readFileSync(
            path.join(process.cwd(), "public/image/image.png")
        );
    } catch { }

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
                                        text: "Mooring Master's Job Report",
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
                            docInfoRow("Form No:", docInfo.formNo || "OPS-OFD-009"),
                            docInfoRow("Rev.No.", docInfo.revisionNo || ""),
                            docInfoRow("Issue Date:", formatDate(docInfo.issueDate)),
                            docInfoRow("Approved by:", docInfo.approvedBy || "JS"),
                            docInfoRow("Page:", "1 of 1"),
                        ]
                    })
                ]
            })
        ]
    });

    /* ================= MAIN DATA TABLE ================= */

    const tableBorder = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    };

    const dataTableRows = [
        // Header row
        new TableRow({
            children: [
                tableCell("Detail", true, 30),
                tableCell("Ship to be Lightered (STBL)", true, 35),
                tableCell("Receiving Ship", true, 35),
            ]
        }),
        // Data rows
        dataRow("Location/STS position", stbl.locationSTSPosition, receiving.locationSTSPosition),
        dataRow("Name", stbl.vesselName, receiving.vesselName),
        dataRow("Arrival Displacement", stbl.arrivalDisplacement, receiving.arrivalDisplacement),
        dataRow("Arrival Drafts", stbl.arrivalDrafts, receiving.arrivalDrafts),
        dataRow("PBL AT Commencement of Transfer on arrival drafts", stbl.pblCommencementArrivalDrafts, receiving.pblCommencementArrivalDrafts),
        dataRow("PBL from Centre of manifold to forward on arrival drafts", stbl.pblCentreManifoldForwardArrival, receiving.pblCentreManifoldForwardArrival),
        dataRow("PBL from Centre of manifold to aft on arrival drafts", stbl.pblCentreManifoldAftArrival, receiving.pblCentreManifoldAftArrival),
        dataRow("PBL at completion of transfer on departure drafts", stbl.pblCompletionDepartureDrafts, receiving.pblCompletionDepartureDrafts),
        dataRow("Max Freeboard:", stbl.maxFreeboard, receiving.maxFreeboard),
        dataRow("Min Freeboard:", stbl.minFreeboard, receiving.minFreeboard),
        dataRow("Dead Slow Ahead Speed", stbl.deadSlowAheadSpeed, receiving.deadSlowAheadSpeed),
        dataRow("Distance from Bridge Wing to Centre Manifold", stbl.bridgeWingToCentreManifoldDistance, receiving.bridgeWingToCentreManifoldDistance),
        dataRow("Is the crane certified for transfer of personnel?", formatBoolean(stbl.craneCertifiedForPersonnelTransfer), formatBoolean(receiving.craneCertifiedForPersonnelTransfer)),
        dataRow("If the crane is not certified is the Master of the Vessel willing to use it for Personnel Transfer?", formatBoolean(stbl.masterWillingIfCraneNotCertified), formatBoolean(receiving.masterWillingIfCraneNotCertified)),
        dataRow("Maximum Crane reach over the ships side:", stbl.maxCraneReachOverShipsSide, receiving.maxCraneReachOverShipsSide),
        dataRow("Is the vessel fitted with Bow Thruster", formatBoolean(stbl.bowThrusterFitted), formatBoolean(receiving.bowThrusterFitted)),
        dataRow("Is the Master of the vessel happy to conduct Nighttime berthing?", formatBoolean(stbl.nightBerthingAccepted), formatBoolean(receiving.nightBerthingAccepted)),
        dataRow("Cargo", stbl.cargo, receiving.cargo),
        dataRow("Quantity to be transferred", stbl.quantityToTransfer, receiving.quantityToTransfer),
        dataRow("Fender Size", formatEquipmentSet(stbl.fenderSizes), formatEquipmentSet(receiving.fenderSizes)),
        dataRow("Fender Serial Number", formatEquipmentSet(stbl.fenderSerialNumbers), formatEquipmentSet(receiving.fenderSerialNumbers)),
        dataRow("Vapor Hoses", formatEquipmentSet(stbl.vaporHoses), formatEquipmentSet(receiving.vaporHoses)),
        dataRow("Hose Size", formatEquipmentSet(stbl.hoseSizes), formatEquipmentSet(receiving.hoseSizes)),
        dataRow("Hose Serial Number", formatEquipmentSet(stbl.hoseSerialNumbers), formatEquipmentSet(receiving.hoseSerialNumbers)),
        dataRow("Agents", stbl.agents, receiving.agents),
        dataRow("Other Information", stbl.otherInformation || receiving.otherInformation || "", ""),
    ];

    const dataTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: dataTableRows
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
                    dataTable,
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

function dataRow(detail, stblValue, receivingValue) {
    return new TableRow({
        children: [
            tableCell(detail, false, 30),
            tableCell(stblValue || "", false, 35),
            tableCell(receivingValue || "", false, 35),
        ]
    });
}

function formatBoolean(value) {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "";
}

function formatEquipmentSet(equipmentSet) {
    if (!equipmentSet || !equipmentSet.values || !Array.isArray(equipmentSet.values)) {
        return "";
    }
    return equipmentSet.values.filter(v => v).join(", ");
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
