import fs from "node:fs";
import path from "node:path";
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

const FORM_TITLE = "SHIP'S STANDARD QUESTIONNAIRE";

// Question texts matching the form
const QUESTIONS = [
    { id: 1, text: "Kindly confirm if your vessel has STS Transfer Plan duly approved by flag state and what are the 'STS Environmental Operating Limits' with respect to approaching, mooring, anchoring, berthing, unmooring, cargo operation in terms of wind speed, sea state, swell and visibility." },
    { id: 2, text: "For Annex 1 cargo, does your vessel have an STS Plan which complies with resolution MEPC 186(59), Chapter 8 of MARPOL 73/78?" },
    { id: 3, text: "Does the vessel maintain a Mooring System Management Plan (MSMP) that includes a Line Management Plan (LMP) If yes, please provide a copy of review." },
    { id: 4, text: "Does the operator permit your vessel to undertake the berthing in the hours of darkness and confirm if the same is allowed by vessel's charterers as well" },
    { id: 5, text: "Is the vessel in compliance with the latest edition of the OCIMF \"Ship-to-ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases First Edition 2013\" and ISGOTT." },
    { id: 6, text: "Kindly confirm the speed of the vessel at D.S. Ahead in the maneuvering condition and can vessel engine maintain D.S. Ahead for a minimum of 2 hours" },
    { id: 7, text: "Can the vessels maneuver as per the underway berthing (Sec 6.2.2) and underway transfer procedure (Sec 6.2.4) as laid down by the Ship-to-Ship Transfer guide for Petroleum, Chemicals and Liquefied Gases" },
    { id: 8, text: "Confirm if your vessel is clear of any overhanging projections, including extended bridge wing." },
    { id: 9, text: "Please confirm there are no operational deficiencies onboard the vessel including vessel's bridge, bridge wing, rudder indicator, ER Rev Counters, compass repeaters, main engine, rudder and steering motors." },
    { id: 10, text: "What is the current Gyro error?" },
    { id: 11, text: "Confirm your radar usage will be in line with 'Ship to Ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases' Section 3.10.6? If 'No' why?" },
    { id: 12, text: "What is the expected displacement of the vessel on arrival and departure from STS Location" },
    { id: 13, text: "What is the anticipated arrival and departure draft at the STS Location" },
    { id: 14, text: "What is the anticipated arrival and departure free board at the STS Location" },
    { id: 15, text: "What is the maximum and minimum free board during the STS Transfer" },
    { id: 16, text: "Please mention: a. What is the parallel body on arrival and upon departure b. Parallel distance ahead of center of manifold on arrival and departure c. Parallel distance astern of center of manifold on arrival and departure" },
    { id: 17, text: "Will the shearing forces and bending moments on the vessel remain within seagoing limits throughout the STS transfer" },
    { id: 18, text: "Kindly send us a general arrangement plan or deck mooring diagram." },
    { id: 19, text: "Please confirm if the location and number of enclosed fairleads and mooring bitts fitted onboard comply with latest 'OCIMF Mooring Equipment Guidelines'." },
    { id: 20, text: "Can the vessel be able to send 4 head, 4 stern lines and 2 spring lines each end, all on winch drum and through closed fairleads." },
    { id: 21, text: "Please share the break holding capacity (BHC) & last test date of each mooring winches to be used for this mooring operation." },
    { id: 22, text: "Does your vessel have at each mooring location, mooring lines of suitable strength to aid passing of 2 mooring wires." },
    { id: 23, text: "Kindly confirm if all the personnel are well acquainted of section on snap-back in the 'Effective Mooring' guide section 4.7, 'MEG3' section 6" },
    { id: 24, text: "Are long handled fire axes or suitable cutting equipment placed at each mooring station" },
    { id: 25, text: "Please advise if vessel has mooring rope tails if yes, kindly advise their conditions and number of spare tails available." },
    { id: 26, text: "Confirm if all mooring lines and mooring tails are in good working condition, appropriate for purpose and less than 10 years old" },
    { id: 27, text: "Please confirm below regarding vessels mooring lines." },
    { id: 28, text: "Please confirm below regarding vessel's mooring tails." },
    { id: 29, text: "To avoid damage to the chocks, kindly confirm if the vessel has chafe protection cover for mooring ropes and grease for wires." },
    { id: 30, text: "Does the vessel's manifold arrangement and lifting gears comply with OCIMF Or SIGTTO recommendations for the ship type / size" },
    { id: 31, text: "Has Cargo / COW / IG Line / COP Emergency Trips / IG Alarms and trips been tested, please specify the date." },
    { id: 32, text: "Manifold connections and Rates" },
    { id: 33, text: "For LPG Carrier Only" },
    { id: 34, text: "Please confirm if the vessel has hang-off ropes available for supporting hoses (i.e. 2 pieces approx. 30mm dia. x 15m long)" },
    { id: 35, text: "Kindly confirm if IG System is fully operational and all cargo tanks are inerted <8% O2." },
    { id: 36, text: "Can your vessel conduct vapor balancing" },
    { id: 37, text: "Please mention the arrangement of vapor manifold connection." },
    { id: 38, text: "is the vessel able to present 2 manifold hose connections of 6\"/8\"/10\" vapor return hoses with correct flange bodies" },
    { id: 39, text: "Please advise the size of your manifold hose connections for vapor hoses. Please advise if you require Oceane Fenders to provide suitable reducers for vapor hoses" },
    { id: 40, text: "Kindly advise" },
    { id: 41, text: "What is the SWL and outreach of the lifting equipment to be utilized" },
    { id: 42, text: "Personal Transfer Basket (PTB)" },
    { id: 43, text: "Personnel Transfer Basket (if permitted) – have you completed our PTB checklist OPS-OFD-028?" },
    { id: 44, text: "Please confirm if English is common spoken language for all communication." },
    { id: 45, text: "Is there sufficient accommodation available for the Mooring Master and will he be allowed to use vessel' Satellite Phone and Wifi as and when requested." },
    { id: 46, text: "Does your vessel have an STS Emergency Plan to mitigate contingencies and pollution; and Port Contact list as per required by SOPEP" },
    { id: 47, text: "Have you conducted emergency drills in the last 7 days as per the guidelines of OCIMF \"Ship-to-ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases First Edition 2013\"" },
    { id: 48, text: "Does the vessel have a risk assessment for the STS Operation please provide a copy." },
    { id: 49, text: "Are all the lights on your vessel in operational condition and is the lighting adequate for STS operations?" },
    { id: 50, text: "Is there sufficient crew for each stage of the STS operation while minimizing the potential for fatigue?" },
    { id: 51, text: "Can you confirm the pilot boarding arrangements and MOB recovery procedures are in place (including life buoy to be ready), in good order and well understood by the crew? If no, please provide details" },
    { id: 52, text: "Does the Master and crew have STS experience as per STS Guide section 1.8?" },
    { id: 53, text: "What is the MARSEC level of your vessel currently maintaining" },
    { id: 54, text: "Please confirm oil major vetting status -No of vetting approvals" },
    { id: 55, text: "Does owner warrant that all Recognized Organization and Flag Administration Certification / requirements are valid for the intended STS Operation" },
    { id: 56, text: "Coronavirus (COVID 19) Please advise: Is all your crewmember vaccinated against COVID 19 and not suffering from any high fever, dry cough, runny nose and breathing difficulties and not in isolation" },
    { id: 57, text: "Owners/Operators/Charterer of the proposed vessel CONFIRM that the vessel(s) covered by this request, the direct and indirect owners of such vessel(s), the cargo, and the origin & destination of such cargo, are not identified on a list of Sanctions by United Nations Security Council, EU, UK, or US, but not limited to, on the US Department of Treasury (OFAC) List of Specially Designated Nationals." }
];

export async function generateOpsOfd001ADoc(questionnaire, fullPath) {
    const docInfo = questionnaire.documentInfo || {};
    const basicInfo = questionnaire.basicInfo || {};
    const responses = questionnaire.responses || {};
    const signature = questionnaire.signature || {};

    console.log("📄 Generating OPS-OFD-001A document:", {
        hasBasicInfo: !!basicInfo,
        basicInfo: JSON.stringify(basicInfo, null, 2),
        basicInfoKeys: Object.keys(basicInfo),
        proposedLocation: basicInfo?.proposedLocation,
        shipName: basicInfo?.shipName,
        date: basicInfo?.date,
        responsesCount: Object.keys(responses).length,
        hasSignature: !!signature,
        signatureKeys: Object.keys(signature),
        signatureUrl: signature.signature?.substring(0, 50) + "...",
        questionnaireKeys: Object.keys(questionnaire)
    });

    const totalPages = 9;

    // Build all pages
    const sections = [
        buildPage1(questionnaire, basicInfo, responses, totalPages),
        buildPage2(questionnaire, responses, totalPages),
        buildPage3(questionnaire, responses, totalPages),
        buildPage4(questionnaire, responses, totalPages),
        buildPage5(questionnaire, responses, totalPages),
        buildPage6(questionnaire, responses, totalPages),
        buildPage7(questionnaire, responses, totalPages),
        buildPage8(questionnaire, responses, totalPages),
        buildPage9(questionnaire, responses, signature, totalPages)
    ];

    const pageMargins = {
        top: 500,
        right: 600,
        bottom: 500,
        left: 600
    };

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
// PAGE 1: Basic Info + Questions 1-7
// ================================================================
function buildPage1(questionnaire, basicInfo, responses, totalPages) {
    console.log("📄 Building Page 1 with basicInfo:", JSON.stringify(basicInfo, null, 2));
    
    return [
        buildHeaderTable(questionnaire, 1, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 150 } }), // Reduced spacing
        buildBasicInfoTable(basicInfo),
        new Paragraph({ spacing: { before: 150 } }), // Reduced spacing
        buildIntroductionParagraph(),
        new Paragraph({ spacing: { before: 150 } }), // Reduced spacing
        ...buildQuestionsWithReplies(1, 7, responses),
        new Paragraph({ spacing: { before: 100 } }), // Reduced spacing before footer
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 2: Questions 8-15
// ================================================================
function buildPage2(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 2, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(8, 15, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 3: Questions 16-23
// ================================================================
function buildPage3(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 3, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(16, 23, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 4: Questions 24-31
// ================================================================
function buildPage4(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 4, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(24, 31, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 5: Questions 32-33
// ================================================================
function buildPage5(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 5, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(32, 33, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 6: Questions 34-41
// ================================================================
function buildPage6(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 6, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(34, 41, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 7: Questions 42-46
// ================================================================
function buildPage7(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 7, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(42, 46, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 8: Questions 47-53
// ================================================================
function buildPage8(questionnaire, responses, totalPages) {
    return [
        buildHeaderTable(questionnaire, 8, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(47, 53, responses),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// PAGE 9: Questions 54-57 + Signature
// ================================================================
function buildPage9(questionnaire, responses, signature, totalPages) {
    return [
        buildHeaderTable(questionnaire, 9, totalPages, FORM_TITLE),
        new Paragraph({ spacing: { before: 200 } }),
        ...buildQuestionsWithReplies(54, 57, responses),
        new Paragraph({ spacing: { before: 400 } }),
        buildSignatureSection(signature),
        new Paragraph({ spacing: { before: 200 } }),
        buildDisclaimer(),
        new Paragraph({ spacing: { before: 200 } }),
        buildFooterLine(FORM_TITLE)
    ];
}

// ================================================================
// BASIC INFO TABLE
// ================================================================
function buildBasicInfoTable(basicInfo) {
    console.log("📋 Building Basic Info Table with data:", {
        proposedLocation: basicInfo?.proposedLocation,
        shipName: basicInfo?.shipName,
        date: basicInfo?.date,
        allKeys: Object.keys(basicInfo || {})
    });
    
    const rows = [
        makeInfoRow("Proposed Location:", basicInfo?.proposedLocation || ""),
        makeInfoRow("Ship's Name:", basicInfo?.shipName || ""),
        makeInfoRow("Date:", basicInfo?.date ? formatDate(basicInfo.date) : "")
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows
    });
}

function makeInfoRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
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
                width: { size: 70, type: WidthType.PERCENTAGE },
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
// INTRODUCTION PARAGRAPH
// ================================================================
function buildIntroductionParagraph() {
    return new Paragraph({
        spacing: { before: 50, after: 150 }, // Reduced spacing
        children: [
            new TextRun({
                text: "The questionnaire below is specifically based on the guidelines by ICS/OCIMF and to be submitted by each vessel involved in cargo transfer.",
                size: FONT_SIZE
            })
        ]
    });
}

// ================================================================
// BUILD QUESTIONS WITH REPLIES
// ================================================================
function buildQuestionsWithReplies(startQ, endQ, responses) {
    const elements = [];

    for (let qNum = startQ; qNum <= endQ; qNum++) {
        const question = QUESTIONS.find(q => q.id === qNum);
        if (!question) continue;

        // Get response value
        let replyText = getResponseText(qNum, responses);

        // Build question row (dark grey background with white text)
        const questionRow = new TableRow({
            children: [
                new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.TOP,
                    shading: { fill: "808080" }, // Dark grey
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: String(qNum), bold: true, size: FONT_SIZE, color: "FFFFFF" })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.TOP,
                    shading: { fill: "808080" }, // Dark grey
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: question.text, size: FONT_SIZE, color: "FFFFFF" })
                            ]
                        })
                    ]
                })
            ]
        });

        // Build reply row (light background) - reply on next line below question
        // Split reply text by newlines to create proper line breaks
        const replyLines = replyText ? replyText.split('\n').filter(line => line.trim() !== '') : [];
        
        const replyParagraphs = [
            new Paragraph({
                spacing: { before: 100 },
                children: [
                    new TextRun({ text: "Vessel's Reply:", bold: true, size: FONT_SIZE })
                ]
            })
        ];
        
        // Add each line as a separate paragraph for proper spacing
        replyLines.forEach((line, index) => {
            replyParagraphs.push(
                new Paragraph({
                    spacing: { before: index === 0 ? 100 : 50 },
                    children: [
                        new TextRun({ text: line.trim(), size: FONT_SIZE })
                    ]
                })
            );
        });
        
        // If no reply, add empty paragraph
        if (replyLines.length === 0) {
            replyParagraphs.push(
                new Paragraph({
                    spacing: { before: 100 },
                    children: [
                        new TextRun({ text: "", size: FONT_SIZE })
                    ]
                })
            );
        }

        const replyRow = new TableRow({
            children: [
                new TableCell({
                    width: { size: 10, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.TOP,
                    shading: { fill: "F5F5F5" }, // Light grey
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "", size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 90, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.TOP,
                    shading: { fill: "F5F5F5" }, // Light grey
                    children: replyParagraphs
                })
            ]
        });

        // Create table for this question
        const questionTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: makeBorder(),
                bottom: makeBorder(),
                left: makeBorder(),
                right: makeBorder(),
                insideHorizontal: makeBorder(),
                insideVertical: makeBorder()
            },
            rows: [questionRow, replyRow]
        });

        elements.push(questionTable);
        elements.push(new Paragraph({ spacing: { before: 100 } })); // Reduced spacing between questions
    }

    return elements;
}

// ================================================================
// GET RESPONSE TEXT
// ================================================================
function getResponseText(qNum, responses) {
    const qKey = `q${qNum}`;
    const response = responses[qKey];

    if (!response) return "";

    // Handle complex responses
    if (typeof response === "object") {
        if (qNum === 16) {
            return `a. ${response.parallelBodyArrivalDeparture || ""}\nb. ${response.parallelDistanceAheadManifold || ""}\nc. ${response.parallelDistanceAsternManifold || ""}`;
        }
        if (qNum === 27) {
            return `Date of Certificate: ${response.certificateDate ? formatDate(response.certificateDate) : ""}\nDate put in use: ${response.putInUseDate ? formatDate(response.putInUseDate) : ""}\nDate of Last inspection: ${response.lastInspectionDate ? formatDate(response.lastInspectionDate) : ""}\nDate of End to End change: ${response.endToEndChangeDate ? formatDate(response.endToEndChangeDate) : ""}`;
        }
        if (qNum === 28) {
            return `Date of Certificate: ${response.certificateDate ? formatDate(response.certificateDate) : ""}\nDate put in use: ${response.putInUseDate ? formatDate(response.putInUseDate) : ""}\nLast Inspection date: ${response.lastInspectionDate ? formatDate(response.lastInspectionDate) : ""}`;
        }
        if (qNum === 32) {
            return `1. Please confirm if the vessel can provide manifold connection as mentioned in the pre-arrival message and confirm size of your manifold hose connections: ${response.manifoldConnectionAvailable || ""}\n2. Kindly advise us of the number and size of reducers that are available: ${response.reducersAvailable || ""}\n3. For this cargo, please advise vessel's maximum discharging/receiving rate using:\n   1 Manifold: ${response.maxDischargeReceivingRate?.oneManifold || ""}\n   2 Manifolds: ${response.maxDischargeReceivingRate?.twoManifold || ""}\n4. Please advise if you require Oceane Fenders to provide suitable reducers: ${response.oceaneFendersRequired || ""}\n5. During the cargo transfer what is the maximum pressure at manifold expected to be during cargo transfer: ${response.maxManifoldPressureDuringTransfer || ""}\n6. Discharging Vessel - Please confirm estimated discharge time including stripping as applicable: ${response.dischargeEstimatedTime || ""}\n7. With a 10" Guttleling hose string (Max. throughput = 2736m3/hr Per String): ${response.hoseThroughput?.hose10InGuttling || ""}\n   With a 12" Yokohama hose string (Max. throughput = 3945m3/hr Per String): ${response.hoseThroughput?.hose12InYokohama || ""}\n   With an 8" Composite hose string (Max. throughput = 1398m3/hr Per String): ${response.hoseThroughput?.hose8InComposite || ""}\n   With a 10" Composite hose string (Max. throughput = 2189m3/hr Per String): ${response.hoseThroughput?.hose10InComposite || ""}\n   With a 12" Composite hose string (Max. throughput = 3157m3/hr Per String): ${response.hoseThroughput?.hose12InComposite || ""}`;
        }
        if (qNum === 33) {
            return `Does the vessel comply with the OCIMF 'Recommendations for manifolds of refrigerated liquid gas carriers for cargoes from 0 Deg C to Minus 104 Deg C: ${response.ocimfCompliance || ""}\nIs the vessel being able to present 2 manifold hose connections of 8" ANSI 300 or 150ANSI standards: ${response.manifoldConnections8inch || ""}\nFor this cargo, please advise the vessels maximum discharging/receiving rate using:\n   1 Manifold: ${response.maxRate?.oneManifold || ""}\n   2 Manifolds: ${response.maxRate?.twoManifold || ""}\n   3 Manifolds: ${response.maxRate?.threeManifold || ""}`;
        }
        if (qNum === 40) {
            return `Cargo Type: ${response.cargoType || ""}\nGrade of Cargo: ${response.cargoGrade || ""}\nCargo Quantity: ${response.cargoQuantity || ""}\nShippers (as per BOL): ${response.shippers || ""}\nCargo Origin: ${response.cargoOrigin || ""}\nDestination: ${response.destination || ""}\nAny Specific Health Hazard of Cargo: ${response.healthHazard || ""}\nPlease provide MSDS: ${response.msdsProvided || ""}`;
        }
        if (qNum === 42) {
            return `Is the crane certified for the transfer of personnel and in compliance with the Checklist in App F of the OCIMF STS Guide (4 man) & is within test date: ${response.craneCertified || ""}\nDo you have permission of the owners and charterers to use: ${response.permissionFromOwners || ""}\nKindly confirm if Oceane Fenders can utilize it during STS Ops: ${response.oceaneFendersAllowed || ""}`;
        }
    }

    return String(response || "");
}

// ================================================================
// SIGNATURE SECTION
// ================================================================
function buildSignatureSection(signature) {
    const signatureImage = loadSignatureImage(signature.signature, "OPS-OFD-001A");

    const rows = [
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Name:", bold: true, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: signature.name || "", size: FONT_SIZE })
                            ]
                        })
                    ]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Rank:", bold: true, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: signature.rank || "", size: FONT_SIZE })
                            ]
                        })
                    ]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Signature:", bold: true, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: signatureImage
                        ? [
                            new Paragraph({
                                alignment: AlignmentType.LEFT,
                                children: [
                                    new ImageRun({
                                        data: signatureImage,
                                        transformation: { width: 200, height: 80 }
                                    })
                                ]
                            })
                        ]
                        : [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: "", size: FONT_SIZE })
                                ]
                            })
                        ]
                })
            ]
        }),
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Date:", bold: true, size: FONT_SIZE })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    margins: CELL_MARGIN,
                    verticalAlign: VerticalAlign.CENTER,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: signature.date ? formatDate(signature.date) : "", size: FONT_SIZE })
                            ]
                        })
                    ]
                })
            ]
        })
    ];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: makeBorder(),
            bottom: makeBorder(),
            left: makeBorder(),
            right: makeBorder(),
            insideHorizontal: makeBorder(),
            insideVertical: makeBorder()
        },
        rows
    });
}

// ================================================================
// DISCLAIMER
// ================================================================
function buildDisclaimer() {
    return new Paragraph({
        spacing: { before: 200 },
        children: [
            new TextRun({
                text: "Disclaimer: The content of this questionnaire has been only checked by Oceane group; we have no liability for the content of the information submitted onto this document.",
                size: FONT_SIZE_SMALL,
                italics: true
            })
        ]
    });
}

// ================================================================
// FOOTER LINE
// ================================================================
function buildFooterLine(formTitle) {
    return new Paragraph({
        spacing: { before: 50, after: 50 }, // Reduced spacing
        children: [
            new TextRun({
                text: formTitle,
                size: FONT_SIZE_SMALL,
                color: "808080"
            })
        ]
    });
}

// ================================================================
// DATE FORMATTER
// ================================================================
function formatDate(date) {
    if (!date) return "";
    try {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return "";
        
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
        return "";
    }
}
