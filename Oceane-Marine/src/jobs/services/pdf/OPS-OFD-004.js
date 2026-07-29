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
    BorderStyle,
    VerticalAlign,
    ImageRun
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

const FORM_TITLE = "PRE-TRANSFER AGREEMENTS (4A-4F)";

export async function generateOpsOfd004Doc(checklist, fullPath) {
    const transferInfo = checklist.transferInfo || {};
    const checklist4A = checklist.checklist4A || {};
    const checklist4B = checklist.checklist4B || {};
    const checklist4C = checklist.checklist4C || [];
    const checklist4D = checklist.checklist4D || [];
    const checklist4E = checklist.checklist4E || {};
    const checklist4F = checklist.checklist4F || {};
    const signature = checklist.signature || {};

    const totalPages = 8;
    const pageMargins = {
        top: 500,
        right: 600,
        bottom: 500,
        left: 600
    };

    // Build all pages
    const sections = [
        buildPage1(checklist, transferInfo, checklist4A, totalPages),
        buildPage2(checklist, checklist4A, checklist4B, totalPages),
        buildPage3(checklist, checklist4A, checklist4B, totalPages),
        buildPage4(checklist, checklist4B, totalPages),
        buildPage5(checklist, checklist4C, checklist4D, checklist4E, totalPages),
        buildPage6(checklist, checklist4E, checklist4F, totalPages),
        buildPage7(checklist, checklist4F, totalPages),
        buildPage8(checklist, checklist4F, signature, totalPages)
    ];

    const doc = new Document({
        sections: sections.map(children => ({
            properties: { page: { margin: pageMargins } },
            children
        }))
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

// ================================================================
// PAGE 1: CHECKLIST 4A - Part 1 (Items 1-10)
// ================================================================
function buildPage1(checklist, transferInfo, checklist4A, totalPages) {
    const checks = checklist4A.checks || [];
    const items1to10 = checks.filter(item => item.clNumber >= 1 && item.clNumber <= 10);
    
    return [
        buildHeaderTable(checklist, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        buildTransferInfoTable(transferInfo),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4A – GENERIC PRE-TRANSFER AGREEMENTS", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4AChecksTable(items1to10, 0, items1to10.length),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 2: CHECKLIST 4A - Part 2 (Items 11-19) + CHECKLIST 4B (Items 1-9)
// ================================================================
function buildPage2(checklist, checklist4A, checklist4B, totalPages) {
    const checks4A = checklist4A.checks || [];
    const checks4B = checklist4B.checks || [];
    const items11to19 = checks4A.filter(item => item.clNumber >= 11 && item.clNumber <= 19);
    const items1to9 = checks4B.filter(item => item.clNumber >= 1 && item.clNumber <= 9);
    
    return [
        buildHeaderTable(checklist, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        build4AChecksTable(items11to19, 0, items11to19.length),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4B – VAPOUR BALANCING (Items 1-9)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4BChecksTable(items1to9),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 3: CHECKLIST 4B (Items 10-18) + CHECKLIST 4A - Part 3 (Items 20-26)
// ================================================================
function buildPage3(checklist, checklist4A, checklist4B, totalPages) {
    const checks4A = checklist4A.checks || [];
    const checks4B = checklist4B.checks || [];
    const items20to26 = checks4A.filter(item => item.clNumber >= 20 && item.clNumber <= 26);
    const items10to18 = checks4B.filter(item => item.clNumber >= 10 && item.clNumber <= 18);
    
    return [
        buildHeaderTable(checklist, 3, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4B – VAPOUR BALANCING (Items 10-18)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4BChecksTable(items10to18),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4A – CONTINUED (Items 20-26)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4AChecksTable(items20to26, 0, items20to26.length),
        new Paragraph({ spacing: { before: 200 } }),
        buildPVDevicesTable(checklist4B.pvDevices || {}),
        new Paragraph({ spacing: { before: 200 } }),
        buildPressureSettingsTable(checklist4B.pressureSettings || {}),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 4: Vapour Balance 10-18 + related data
// ================================================================
function buildPage4(checklist, checklist4B, totalPages) {
    const checks4B = checklist4B.checks || [];
    const items10to18 = checks4B.filter(item => item.clNumber >= 10 && item.clNumber <= 18);
    
    return [
        buildHeaderTable(checklist, 4, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4B – VAPOUR BALANCING (Items 10-18)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4BChecksTable(items10to18),
        new Paragraph({ spacing: { before: 200 } }),
        buildPVDevicesTable(checklist4B.pvDevices || {}),
        new Paragraph({ spacing: { before: 200 } }),
        buildPressureSettingsTable(checklist4B.pressureSettings || {}),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 5: Additional for Chemical tankers 1-2, Additional for LPG and LNG transfer 1-9, Additional for LNG transfer 1
// ================================================================
function buildPage5(checklist, checklist4C, checklist4D, checklist4E, totalPages) {
    return [
        buildHeaderTable(checklist, 5, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4C – CHEMICAL TANKERS (Items 1-2)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4CChecksTable(checklist4C),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4D – LPG AND LNG TRANSFER (Items 1-9)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4DChecksTable(checklist4D),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4E – LNG TRANSFER (Item 1)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4ELimitedTable(checklist4E),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 6: Additional for LNG transfer 2-5, CL 4F Pretransfer Agreements 1-8
// ================================================================
function buildPage6(checklist, checklist4E, checklist4F, totalPages) {
    const remainingItems = [
        { label: "Cargo Lines Nitrogen Purged", data: checklist4E.cargoLinesNitrogenPurged },
        { label: "Connections Leak Tested", data: checklist4E.connectionsLeakTested },
        { label: "Nitrogen Plant Operational", data: checklist4E.nitrogenPlantOperational },
        { label: "Water Curtain Running", data: checklist4E.waterCurtainRunning }
    ];
    
    return [
        buildHeaderTable(checklist, 6, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4E – LNG TRANSFER (Items 2-5)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4ERemainingTable(remainingItems),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4F – PRE-TRANSFER AGREEMENTS (Items 1-8)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4FPart1Table(checklist4F),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 7: CL 4F Pretransfer Agreements 9-17
// ================================================================
function buildPage7(checklist, checklist4F, totalPages) {
    return [
        buildHeaderTable(checklist, 7, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4F – PRE-TRANSFER AGREEMENTS (Items 9-17)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4FPart2Table(checklist4F),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 8: CL 4F Pretransfer Agreements 18 + Signature
// ================================================================
function buildPage8(checklist, checklist4F, signature, totalPages) {
    return [
        buildHeaderTable(checklist, 8, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [
                new TextRun({ text: "CHECKLIST 4F – PRE-TRANSFER AGREEMENTS (Item 18)", bold: true, size: FONT_SIZE })
            ]
        }),
        new Paragraph({ spacing: { before: 100 } }),
        build4FPart3Table(checklist4F),
        new Paragraph({ spacing: { before: 400 } }),
        buildSignatureSection(signature),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// HELPER: TRANSFER INFO TABLE
// ================================================================
function buildTransferInfoTable(info) {
    const rows = [
        makeInfoRow("Constant Heading Ship:", info.constantHeadingShip || ""),
        makeInfoRow("Maneuvering Ship:", info.manoeuvringShip || ""),
        makeInfoRow("Name of Designated POAC:", info.designatedPOACName || ""),
        makeInfoRow("Name of STS Superintendent If Different from POAC:", info.stsSuperintendentName || ""),
        makeInfoRow("Date of Transfer:", info.transferDate ? formatDate(info.transferDate) : ""),
        makeInfoRow("Location of Transfer:", info.transferLocation || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

function makeInfoRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: label, bold: true, size: FONT_SIZE })
                        ]
                    })
                ]
            }),
            new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                margins: CELL_MARGIN,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({ text: value || "", size: FONT_SIZE })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// HELPER: 4A CHECKS TABLE
// ================================================================
function build4AChecksTable(checks, startIdx, endIdx) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL", 8, true),
            createHeaderCell("Generic Checks", 52, false),
            createHeaderCell("CHS", 10, true),
            createHeaderCell("MS", 10, true),
            createHeaderCell("N/A", 10, true),
            createHeaderCell("Remarks", 10, true)
        ]
    });

    const displayChecks = checks.slice(startIdx, endIdx);
    const dataRows = displayChecks.map(item => {
        const status = item.status || {};
        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 52, false),
                createCell(status.chs ? "☑" : "☐", 10, true),
                createCell(status.ms ? "☑" : "☐", 10, true),
                createCell(status.notApplicable ? "☑" : "☐", 10, true),
                createCell(status.remarks || "", 10, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: SIMOPS TABLE
// ================================================================
function buildSIMOPSTable(simops) {
    const items = [
        { label: "Nitrogen Purging/Inerting", data: simops.nitrogenPurgingOrInerting },
        { label: "Repairs/Maintenance", data: simops.repairsMaintenance },
        { label: "Tank Cleaning", data: simops.tankCleaning },
        { label: "COW", data: simops.cow },
        { label: "Slops Discharge", data: simops.slopsDischarge },
        { label: "Waste Discharge", data: simops.wasteDischarge },
        { label: "Bunkering", data: simops.bunkering },
        { label: "Receiving Stores", data: simops.receivingStores },
        { label: "Personnel Transfer", data: simops.personnelTransfer },
        { label: "Crew Change", data: simops.crewChange },
        { label: "Planned Drills", data: simops.plannedDrills }
    ];

    const headerRow = new TableRow({
        children: [
            createHeaderCell("Operation", 52, false),
            createHeaderCell("CHS", 12, true),
            createHeaderCell("MS", 12, true),
            createHeaderCell("N/A", 12, true),
            createHeaderCell("Remarks", 12, true)
        ]
    });

    const dataRows = items.map(item => {
        const status = item.data || {};
        return new TableRow({
            children: [
                createCell(item.label, 52, false),
                createCell(status.chs ? "☑" : "☐", 12, true),
                createCell(status.ms ? "☑" : "☐", 12, true),
                createCell(status.notApplicable ? "☑" : "☐", 12, true),
                createCell(status.remarks || "", 12, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4B CHECKS TABLE
// ================================================================
function build4BChecksTable(checks) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL", 8, true),
            createHeaderCell("Vapour Balancing Checks", 52, false),
            createHeaderCell("CHS", 10, true),
            createHeaderCell("MS", 10, true),
            createHeaderCell("N/A", 10, true),
            createHeaderCell("Remarks", 10, true)
        ]
    });

    const dataRows = checks.map(item => {
        const status = item.status || {};
        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 52, false),
                createCell(status.chs ? "☑" : "☐", 10, true),
                createCell(status.ms ? "☑" : "☐", 10, true),
                createCell(status.notApplicable ? "☑" : "☐", 10, true),
                createCell(status.remarks || "", 10, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: PV DEVICES TABLE
// ================================================================
function buildPVDevicesTable(pvDevices) {
    const rows = [
        makeInfoRow("Liquid P/V Breaker:", pvDevices.liquidPVBreaker || ""),
        makeInfoRow("Tank P/V Valves:", pvDevices.tankPVValves || ""),
        makeInfoRow("Mast Head P/V Valves:", pvDevices.mastHeadPVValves || ""),
        makeInfoRow("Other P/V Devices:", pvDevices.otherPVDevices || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

// ================================================================
// HELPER: PRESSURE SETTINGS TABLE
// ================================================================
function buildPressureSettingsTable(settings) {
    const rows = [
        makeInfoRow("Max Pressure Differential:", settings.maxPressureDifferential || ""),
        makeInfoRow("Cargo Tank Pressure Range:", settings.cargoTankPressureRange || ""),
        makeInfoRow("Cargo Tank Pressure Alarm (High):", settings.cargoTankPressureAlarm?.high || ""),
        makeInfoRow("Cargo Tank Pressure Alarm (Low):", settings.cargoTankPressureAlarm?.low || ""),
        makeInfoRow("IG Main Pressure Alarm (High):", settings.igMainPressureAlarm?.high || ""),
        makeInfoRow("IG Main Pressure Alarm (Low):", settings.igMainPressureAlarm?.low || ""),
        makeInfoRow("Vapour Emission Pressure Alarm (High):", settings.vapourEmissionPressureAlarm?.high || ""),
        makeInfoRow("Vapour Emission Pressure Alarm (Low):", settings.vapourEmissionPressureAlarm?.low || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

// ================================================================
// HELPER: 4C CHECKS TABLE
// ================================================================
function build4CChecksTable(checks) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL", 8, true),
            createHeaderCell("Chemical Tanker Checks", 52, false),
            createHeaderCell("CHS", 10, true),
            createHeaderCell("MS", 10, true),
            createHeaderCell("N/A", 10, true),
            createHeaderCell("Remarks", 10, true)
        ]
    });

    const dataRows = checks.map(item => {
        const status = item.status || {};
        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 52, false),
                createCell(status.chs ? "☑" : "☐", 10, true),
                createCell(status.ms ? "☑" : "☐", 10, true),
                createCell(status.notApplicable ? "☑" : "☐", 10, true),
                createCell(status.remarks || "", 10, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4D CHECKS TABLE
// ================================================================
function build4DChecksTable(checks) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("CL", 8, true),
            createHeaderCell("LPG/LNG Checks", 52, false),
            createHeaderCell("CHS", 10, true),
            createHeaderCell("MS", 10, true),
            createHeaderCell("N/A", 10, true),
            createHeaderCell("Remarks", 10, true)
        ]
    });

    const dataRows = checks.map(item => {
        const status = item.status || {};
        return new TableRow({
            children: [
                createCell(String(item.clNumber || ""), 8, true),
                createCell(item.description || "", 52, false),
                createCell(status.chs ? "☑" : "☐", 10, true),
                createCell(status.ms ? "☑" : "☐", 10, true),
                createCell(status.notApplicable ? "☑" : "☐", 10, true),
                createCell(status.remarks || "", 10, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4E CHECKS TABLE
// ================================================================
function build4EChecksTable(checklist4E) {
    const items = [
        { label: "ESD/ERS Arrangements Tested", data: checklist4E.esdErsArrangementsTested },
        { label: "Cargo Lines Nitrogen Purged", data: checklist4E.cargoLinesNitrogenPurged },
        { label: "Connections Leak Tested", data: checklist4E.connectionsLeakTested },
        { label: "Nitrogen Plant Operational", data: checklist4E.nitrogenPlantOperational },
        { label: "Water Curtain Running", data: checklist4E.waterCurtainRunning }
    ];

    const headerRow = new TableRow({
        children: [
            createHeaderCell("LNG Checks", 52, false),
            createHeaderCell("CHS", 12, true),
            createHeaderCell("MS", 12, true),
            createHeaderCell("N/A", 12, true),
            createHeaderCell("Remarks", 12, true)
        ]
    });

    const dataRows = items.map(item => {
        const status = item.data || {};
        return new TableRow({
            children: [
                createCell(item.label, 52, false),
                createCell(status.chs ? "☑" : "☐", 12, true),
                createCell(status.ms ? "☑" : "☐", 12, true),
                createCell(status.notApplicable ? "☑" : "☐", 12, true),
                createCell(status.remarks || "", 12, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4E LIMITED CHECKS TABLE (Only first item)
// ================================================================
function build4ELimitedTable(checklist4E) {
    const items = [
        { label: "ESD/ERS Arrangements Tested", data: checklist4E.esdErsArrangementsTested },
    ];

    const headerRow = new TableRow({
        children: [
            createHeaderCell("LNG Checks", 52, false),
            createHeaderCell("CHS", 12, true),
            createHeaderCell("MS", 12, true),
            createHeaderCell("N/A", 12, true),
            createHeaderCell("Remarks", 12, true)
        ]
    });

    const dataRows = items.map(item => {
        const status = item.data || {};
        return new TableRow({
            children: [
                createCell(item.label, 52, false),
                createCell(status.chs ? "☑" : "☐", 12, true),
                createCell(status.ms ? "☑" : "☐", 12, true),
                createCell(status.notApplicable ? "☑" : "☐", 12, true),
                createCell(status.remarks || "", 12, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4E REMAINING CHECKS TABLE (Items 2-5)
// ================================================================
function build4ERemainingTable(items) {
    const headerRow = new TableRow({
        children: [
            createHeaderCell("LNG Checks", 52, false),
            createHeaderCell("CHS", 12, true),
            createHeaderCell("MS", 12, true),
            createHeaderCell("N/A", 12, true),
            createHeaderCell("Remarks", 12, true)
        ]
    });

    const dataRows = items.map(item => {
        const status = item.data || {};
        return new TableRow({
            children: [
                createCell(item.label, 52, false),
                createCell(status.chs ? "☑" : "☐", 12, true),
                createCell(status.ms ? "☑" : "☐", 12, true),
                createCell(status.notApplicable ? "☑" : "☐", 12, true),
                createCell(status.remarks || "", 12, false)
            ]
        });
    });

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [headerRow, ...dataRows]
    });
}

// ================================================================
// HELPER: 4F PART 1 TABLE
// ================================================================
function build4FPart1Table(checklist4F) {
    const rows = [
        makeInfoRow("JPO Latest Version:", checklist4F.jpo?.latestVersion || ""),
        makeInfoRow("JPO Date Version:", checklist4F.jpo?.dateVersion || ""),
        makeInfoRow("Working Language:", checklist4F.workingLanguage || ""),
        makeInfoRow("Agreed SIMOPS:", checklist4F.agreedSIMOPS ? "Yes" : "No"),
        makeInfoRow("Ships Ready for Manoeuvring (Notice Period):", checklist4F.shipsReadyForManoeuvring?.noticePeriod || ""),
        makeInfoRow("Communication System (Primary):", checklist4F.communicationSystem?.primarySystem || ""),
        makeInfoRow("Communication System (Backup):", checklist4F.communicationSystem?.backupSystem || ""),
        makeInfoRow("Stop Cargo Transfer:", checklist4F.stopCargoTransfer || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

// ================================================================
// HELPER: 4F PART 2 TABLE
// ================================================================
function build4FPart2Table(checklist4F) {
    const rows = [
        makeInfoRow("Max Wind Speed:", checklist4F.environmentalLimits?.maxWindSpeed || ""),
        makeInfoRow("Current:", checklist4F.environmentalLimits?.current || ""),
        makeInfoRow("Swell:", checklist4F.environmentalLimits?.swell || ""),
        makeInfoRow("Max Transfer Rates:", checklist4F.cargoBallastLimits?.maxTransferRates || ""),
        makeInfoRow("Topping Off Rates:", checklist4F.cargoBallastLimits?.toppingOffRates || ""),
        makeInfoRow("Max Manifold Pressure:", checklist4F.cargoBallastLimits?.maxManifoldPressure || ""),
        makeInfoRow("Cargo Temperature:", checklist4F.cargoBallastLimits?.cargoTemperature || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

// ================================================================
// HELPER: 4F PART 3 TABLE
// ================================================================
function build4FPart3Table(checklist4F) {
    const rows = [
        makeInfoRow("Emergency Signal (Ship 1):", checklist4F.emergencySignals?.ship1Signal || ""),
        makeInfoRow("Emergency Signal (Ship 2):", checklist4F.emergencySignals?.ship2Signal || ""),
        makeInfoRow("Emergency Signal (Terminal):", checklist4F.emergencySignals?.terminalSignal || ""),
        makeInfoRow("Tank System (Ship 1):", checklist4F.tankSystem?.ship1System || ""),
        makeInfoRow("Tank System (Ship 2):", checklist4F.tankSystem?.ship2System || "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows
    });
}

// ================================================================
// HELPER: SIGNATURE SECTION
// ================================================================
function buildSignatureSection(signature) {
    const signatureImage = loadSignatureImage(signature.signature, "OPS-OFD-004");

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: fullBorders(),
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Name:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.name || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Rank:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.rank || "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Signature:", size: FONT_SIZE })
                                ]
                            }),
                            signatureImage ? new Paragraph({
                                spacing: { before: 100 },
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new ImageRun({
                                        data: signatureImage,
                                        transformation: { width: 150, height: 75 }
                                    })
                                ]
                            }) : new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    }),
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        margins: CELL_MARGIN,
                        verticalAlign: VerticalAlign.CENTER,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "Date:", size: FONT_SIZE })
                                ]
                            }),
                            new Paragraph({
                                spacing: { before: 100 },
                                children: [
                                    new TextRun({ text: signature.date ? formatDate(signature.date) : "", size: FONT_SIZE })
                                ]
                            })
                        ]
                    })
                ]
            })
        ]
    });
}

// ================================================================
// HELPER: FOOTER LINE
// ================================================================
function buildFooterLine(title) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: title.toUpperCase(),
                italics: true,
                size: FONT_SIZE_SMALL
            })
        ]
    });
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================
function fullBorders() {
    return {
        top: makeBorder(),
        bottom: makeBorder(),
        left: makeBorder(),
        right: makeBorder(),
        insideHorizontal: makeBorder(),
        insideVertical: makeBorder()
    };
}

function createHeaderCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: "D3D3D3" },
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, bold: true, size: FONT_SIZE })
                ]
            })
        ]
    });
}

function createCell(text, width, center = false) {
    return new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        margins: CELL_MARGIN,
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment: center ? AlignmentType.CENTER : undefined,
                children: [
                    new TextRun({ text, size: FONT_SIZE })
                ]
            })
        ]
    });
}

function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

