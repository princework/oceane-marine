import {
    Table,
    TableRow,
    TableCell,
    Paragraph,
    TextRun,
    ImageRun,
    WidthType,
    AlignmentType,
    VerticalAlign,
    BorderStyle
} from "docx";
import { readDocumentLogo } from "../../../../lib/brand/documentLogo.js";

/**
 * Builds reusable header table for all pages
 * @param {Object} formData - The form data object
 * @param {number} currentPage - Current page number (1, 2, 3...)
 * @param {number} totalPages - Total number of pages
 * @param {string} formTitle - Form title (e.g., "CHECKLIST 3A & 3B – BEFORE CARGO TRANSFER")
 * @returns {Table} Header table
 */
export function buildHeaderTable(formData, currentPage, totalPages, formTitle) {
    
    // ========== LOAD STATIC LOGO ==========
    let logoImage = null;
    try {
        logoImage = readDocumentLogo();
    } catch (err) {
        console.error("Logo not found:", err.message);
    }

    // ========== EXTRACT DYNAMIC DATA ==========
    const docInfo = formData.documentInfo || {};
    const formNo = docInfo.formNo || formData.formNo || "";
    const revNo = docInfo.revisionNo || formData.revisionNo || "";
    
    let issueDate = "";
    // Check for issueDate first, then revisionDate (both are valid)
    if (docInfo.issueDate) {
        issueDate = formatDate(docInfo.issueDate);
    } else if (docInfo.revisionDate) {
        issueDate = formatDate(docInfo.revisionDate);
    } else if (formData.issueDate) {
        issueDate = formatDate(formData.issueDate);
    } else if (formData.revisionDate) {
        issueDate = formatDate(formData.revisionDate);
    }
    
    const approvedBy = docInfo.approvedBy || formData.approvedBy || "";
    
    // ========== DYNAMIC PAGE NUMBER ==========
    const pageText = `${currentPage} of ${totalPages}`;

    // ✅ FIX: Create new border object each time to avoid docx mutation bug
    const makeBorder = () => ({
        style: BorderStyle.SINGLE,
        size: 8,
        color: "000000"
    });

    // ========== BUILD HEADER TABLE ==========
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
        rows: [
            new TableRow({
                children: [
                    // LEFT CELL - Logo (centered in cell)
                    new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {
                            top: 60,
                            bottom: 60,
                            left: 80,
                            right: 80
                        },
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
                                : new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({ text: "OCEANE", bold: true, size: 24 })
                                    ]
                                })
                        ]
                    }),

                    // CENTER CELL - Title
                    new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {
                            top: 60,
                            bottom: 60,
                            left: 40,
                            right: 40
                        },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({
                                        text: "AT SEA SHIP TO SHIP TRANSFER",
                                        bold: true,
                                        size: 22
                                    })
                                ]
                            }),
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({
                                        text: formTitle || "CHECKLIST",
                                        bold: true,
                                        size: 18
                                    })
                                ]
                            })
                        ]
                    }),

                    // RIGHT CELL - Form Details (nested 2-column table)
                    new TableCell({
                        width: { size: 30, type: WidthType.PERCENTAGE },
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        },
                        children: [
                            buildFormDetailsTable(formNo, revNo, issueDate, approvedBy, pageText)
                        ]
                    })
                ]
            })
        ]
    });
}

/**
 * Builds form details table (right side of header) - proper 2-column layout
 */
function buildFormDetailsTable(formNo, revNo, issueDate, approvedBy, pageText) {
    // ✅ FIX: Create new border object each time to avoid docx mutation bug
    const makeBorder = () => ({
        style: BorderStyle.SINGLE,
        size: 8,
        color: "000000"
    });

    const makeRow = (label, value) => {
        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 20, bottom: 20, left: 40, right: 20 },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: label, size: 16 })
                            ]
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    margins: { top: 20, bottom: 20, left: 20, right: 40 },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({ text: value || "", size: 16 })
                            ]
                        })
                    ]
                })
            ]
        });
    };

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
        rows: [
            makeRow("Form No:", formNo),
            makeRow("Rev.No.:", revNo),
            makeRow("Rev Date:", issueDate),
            makeRow("Approved by:", approvedBy),
            makeRow("Page:", pageText)
        ]
    });
}

/**
 * Formats date to "DD MMM YYYY" format
 */
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
