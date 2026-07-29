import fs from "fs";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
} from "docx";
import { buildQhseDocxHeaderTable, buildDocxMeta } from "./shared/qhseDocxHeader.js";

export async function generateMOCManagementChangeDoc(moc, fullPath) {
    /* ================= HEADER TABLE ================= */
    const meta = buildDocxMeta(moc, "QAF-OFD-058");
    const headerTable = buildQhseDocxHeaderTable({ formTitle: "MANAGEMENT OF CHANGE", meta });

    /* ================= BASIC INFORMATION TABLE ================= */
    const basicInfoRows = [
        ["Proposed Change", moc.proposedChange || ""],
        ["Reason for Change", moc.reasonForChange || ""],
        ["Proposed By", moc.proposedBy || ""],
        ["MOC Initiated By", moc.mocInitiatedBy || ""],
        ["Initiation Date", formatDate(moc.initiationDate)],
        ["Target Implementation Date", formatDate(moc.targetImplementationDate)]
    ];

    const basicInfoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: basicInfoRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= POTENTIAL CONSEQUENCES ================= */
    const consequences = moc.potentialConsequences || {};
    const consequenceLabels = [];
    if (consequences.environment) consequenceLabels.push("Environment");
    if (consequences.safety) consequenceLabels.push("Safety");
    if (consequences.contractual) consequenceLabels.push("Contractual");
    if (consequences.cost) consequenceLabels.push("Cost");
    if (consequences.operational) consequenceLabels.push("Operational");
    if (consequences.reputation) consequenceLabels.push("Reputation");

    const consequencesRows = [
        ["Potential Consequences", consequenceLabels.join(", ") || "None"],
        ["Remarks", consequences.remarks || ""],
        ["Equipment/Facility/Documentation Affected", moc.equipmentFacilityDocumentationAffected || ""]
    ];

    const consequencesTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: consequencesRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= RISK ASSESSMENT ================= */
    const riskRows = [
        ["Risk Assessment Required", moc.riskAssessmentRequired ? "Yes" : "No"],
        ["Risk Level", moc.riskLevel || ""]
    ];

    const riskTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: riskRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= TRAINING ================= */
    const trainingRows = [
        ["Training Required", moc.trainingRequired ? "Yes" : "No"],
        ["Training Details", moc.trainingDetails || ""],
        ["Training Completed", moc.trainingCompleted ? "Yes" : "No"],
        ["Training Completion Date", formatDate(moc.trainingCompletionDate)]
    ];

    const trainingTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: trainingRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= DOCUMENT CONTROL ================= */
    const docControlRows = [
        ["Document Change Required", moc.documentChangeRequired ? "Yes" : "No"],
        ["DCR Number", moc.dcrNumber || ""]
    ];

    const docControlTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: docControlRows.map(([label, value]) =>
            new TableRow({
                children: [
                    tableCell(label, true),
                    tableCell(value || "________________________")
                ]
            })
        )
    });

    /* ================= IMPLEMENTATION DETAILS ================= */
    let implementationTable = null;
    if (moc.changeMadeBy || moc.changeDetails || moc.changeCompletionDate) {
        const implRows = [
            ["Change Made By", typeof moc.changeMadeBy === "object" ? moc.changeMadeBy?.name || "" : moc.changeMadeBy || ""],
            ["Change Details", moc.changeDetails || ""],
            ["Change Completion Date", formatDate(moc.changeCompletionDate)]
        ];

        implementationTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: implRows.map(([label, value]) =>
                new TableRow({
                    children: [
                        tableCell(label, true),
                        tableCell(value || "________________________")
                    ]
                })
            )
        });
    }

    /* ================= STATUS REVIEW ================= */
    let statusReviewTable = null;
    if (moc.statusReview && moc.statusReview !== "Pending") {
        const reviewRows = [
            ["Status Review", moc.statusReview || ""],
            ["Reviewer Comments", moc.reviewerComments || ""],
            ["Rejection Reason", moc.rejectionReason || ""]
        ];

        statusReviewTable = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: reviewRows.map(([label, value]) =>
                new TableRow({
                    children: [
                        tableCell(label, true),
                        tableCell(value || "________________________")
                    ]
                })
            )
        });
    }

    /* ================= DOC ================= */
    const children = [
        headerTable,
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [new TextRun({ text: "BASIC INFORMATION", bold: true, size: 24 })]
        }),
        basicInfoTable,
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [new TextRun({ text: "POTENTIAL CONSEQUENCES", bold: true, size: 24 })]
        }),
        consequencesTable,
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
            children: [new TextRun({ text: "RISK ASSESSMENT", bold: true, size: 24 })]
        }),
        riskTable
    ];

    if (moc.trainingRequired || moc.trainingDetails || moc.trainingCompleted) {
        children.push(
            new Paragraph({ spacing: { before: 200 } }),
            new Paragraph({
                children: [new TextRun({ text: "TRAINING", bold: true, size: 24 })]
            }),
            trainingTable
        );
    }

    if (moc.documentChangeRequired || moc.dcrNumber) {
        children.push(
            new Paragraph({ spacing: { before: 200 } }),
            new Paragraph({
                children: [new TextRun({ text: "DOCUMENT CONTROL", bold: true, size: 24 })]
            }),
            docControlTable
        );
    }

    if (implementationTable) {
        children.push(
            new Paragraph({ spacing: { before: 200 } }),
            new Paragraph({
                children: [new TextRun({ text: "IMPLEMENTATION DETAILS", bold: true, size: 24 })]
            }),
            implementationTable
        );
    }

    if (statusReviewTable) {
        children.push(
            new Paragraph({ spacing: { before: 200 } }),
            new Paragraph({
                children: [new TextRun({ text: "STATUS REVIEW", bold: true, size: 24 })]
            }),
            statusReviewTable
        );
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 500,
                            right: 600,
                            bottom: 500,
                            left: 600
                        }
                    }
                },
                children
            }
        ]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(fullPath, buffer);
}

/* HELPERS */
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
