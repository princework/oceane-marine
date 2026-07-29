import { NextResponse } from "next/server";
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
} from "docx";
import { connectDB } from "@/lib/config/connection";
import NearMiss from "@/lib/mongodb/models/qhse-near-miss/NearMiss";
import {
  buildQhseDocxHeaderTable,
  buildDocxMeta,
} from "@/jobs/services/pdf/shared/qhseDocxHeader.js";

function formatDate(date) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function makeBorder() {
  return {
    style: BorderStyle.SINGLE,
    size: 8,
    color: "000000",
  };
}

function detailRow(label, value) {
  const text = value !== null && value !== undefined && value !== "" ? String(value) : "—";
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 120, right: 60 },
        borders: {
          top: makeBorder(),
          bottom: makeBorder(),
          left: makeBorder(),
          right: makeBorder(),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, size: 22 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        margins: { top: 100, bottom: 100, left: 60, right: 120 },
        borders: {
          top: makeBorder(),
          bottom: makeBorder(),
          left: makeBorder(),
          right: makeBorder(),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text, size: 22 })],
          }),
        ],
      }),
    ],
  });
}

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const report = await NearMiss.findById(id).lean();
    if (!report) {
      return NextResponse.json(
        { error: "Near-miss report not found" },
        { status: 404 }
      );
    }

    const meta = buildDocxMeta(report, "QAF-OFD-015");
    const headerTable = buildQhseDocxHeaderTable({
      formTitle: "NEAR MISS REPORTING",
      meta,
    });

    const recordDetailsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: makeBorder(),
        bottom: makeBorder(),
        left: makeBorder(),
        right: makeBorder(),
        insideHorizontal: makeBorder(),
        insideVertical: makeBorder(),
      },
      rows: [
        detailRow("Serial:", report.serialNumber),
        detailRow("Job Ref No:", report.JobRefNo),
        detailRow("Vessel Name:", report.VesselName),
        detailRow("Time of Incident:", formatDate(report.timeOfIncident)),
        detailRow("Name of Observer:", report.NameOfObserver),
        detailRow("Position of Observer:", report.PositionOfObserver),
        detailRow("Email:", report.email),
        detailRow("Type of Reporting:", report.TypeOfReporting),
        detailRow("Area of Near Miss:", report.AreaOfNearMiss),
        detailRow("Description:", report.Description),
        detailRow("Immediate Cause:", report.ImmediateCause),
        detailRow("Root Cause:", report.RootCause),
        detailRow("Corrective Action:", report.CorrectiveAction),
        detailRow("Status:", report.status),
        detailRow("Remarks by Reviewer:", report.remarksByReviewer),
        detailRow("Created At:", formatDate(report.createdAt)),
      ],
    });

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
              },
            },
          },
          children: [
            headerTable,
            new Paragraph({ spacing: { before: 400, after: 200 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: "Record Details",
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            recordDetailsTable,
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `Near-Miss-${(report.serialNumber || id).replace(/[^a-zA-Z0-9-]/g, "-")}.docx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Near-miss DOCX download error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
