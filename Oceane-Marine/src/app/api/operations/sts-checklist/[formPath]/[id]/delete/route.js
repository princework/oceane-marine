import { NextResponse } from "next/server";
import { connectDB } from "@/lib/config/connection";
import { FORM_CONFIGS } from "../../../_form-configs";
import StsOperation from "@/lib/mongodb/models/sts-documentation/StsOperation";
import { notifyOperationsDelete } from "@/lib/notifications/operationsNotified";

export async function DELETE(req, { params }) {
  await connectDB();

  try {
    const { formPath, id } = await params;

    const config = FORM_CONFIGS[formPath];
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Invalid form path" },
        { status: 400 }
      );
    }

    // Dynamically import the model
    const modelModule = await import(
      `@/lib/mongodb/models/operation-sts-checklist/${config.modelPath}`
    );
    const Model = modelModule.default;

    // Find the record before deletion
    const record = await Model.findById(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Record not found" },
        { status: 404 }
      );
    }

    // Clean up document from StsOperation if checklist has operationRef
    if (record.operationRef) {
      await StsOperation.updateOne(
        { Operation_Ref_No: record.operationRef },
        { $pull: { documents: { documentType: config.formNo, checklistId: id } } }
      );
    }

    // Delete the checklist record
    await Model.findByIdAndDelete(id);

    void notifyOperationsDelete(config.formNo, id);
    return NextResponse.json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}
