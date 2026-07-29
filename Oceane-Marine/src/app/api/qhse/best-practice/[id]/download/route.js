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
import BestPractice from "@/lib/mongodb/models/qhse-best-practices/BestPractice";
import { getQhseFormCode } from "@/lib/constants/qhse-form-codes";
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
    const practice = await BestPractice.findById(id).lean();
    if (!practice) {
      return NextResponse.json(
        { error: "Best practice not found" },
        { status: 404 }
      );
    }

    const formCode = practice.formCode || getQhseFormCode("BEST_PRACTICE") || "QAF-BP";

    const meta = buildDocxMeta(practice, "QAF-BP");
    const headerTable = buildQhseDocxHeaderTable({
      formTitle: "BEST PRACTICES",
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
        detailRow("Form Code:", formCode || "—"),
        detailRow("Serial:", practice.serialNumber),
        detailRow("Event Date:", formatDate(practice.eventDate)),
        detailRow("Description:", practice.description),
        detailRow("Created At:", formatDate(practice.createdAt)),
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
    const fileName = `Best-Practice-${(practice.serialNumber || id).replace(/[^a-zA-Z0-9-]/g, "-")}.docx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Best practice download error:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
