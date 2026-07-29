import MasterFeedbackForm from "../../lib/mongodb/models/operation-sts-checklist/OPS-OFD-020.js";
import Operation from "../../lib/mongodb/models/sts-documentation/StsOperation.js";
import { generateOpsOfd020Doc } from "../services/pdf/OPS-OFD-020.js";
import { getPdfStoragePath } from "../services/pdf/pdfStorage.js";
import fs from "node:fs";
import path from "node:path";

const DOCUMENT_TYPE = "OPS-OFD-020";

export function defineOpsOfd020Job(agenda) {
    agenda.define("generate-ops-ofd-020", async (job) => {
        const { checklistId, operationRef } = job.attrs.data;

        if (!checklistId || !operationRef) {
            throw new Error("Missing checklistId or operationRef in job data");
        }

        try {
            console.log("🚀 Starting OPS-OFD-020 document generation job", { checklistId, operationRef });

            // ==================== ENSURE MONGODB CONNECTION ====================
            const mongoose = await import("mongoose");
            if (mongoose.default.connection.readyState !== 1) {
                throw new Error("MongoDB connection is not ready");
            }

            // ==================== FETCH FORM ====================
            const form = await MasterFeedbackForm.findById(checklistId).lean();
            if (!form) {
                throw new Error(`Form not found with ID: ${checklistId}`);
            }

            if (!form.sequenceNumber) {
                throw new Error("Form missing sequenceNumber");
            }

            console.log(`📄 Generating document with Revision: ${form.documentInfo?.revisionNo || "N/A"}`, {
                checklistId,
                operationRef,
                sequenceNumber: form.sequenceNumber,
            });

            // ==================== GENERATE FILE PATHS (CREATES FOLDERS) ====================
            const fileName = `${DOCUMENT_TYPE}-${form.sequenceNumber}.docx`;
            const { fullPath, dbPath } = await getPdfStoragePath(operationRef, fileName);

            console.log(`📁 File paths generated:`, { fullPath, dbPath });

            if (!fullPath.endsWith(".docx") || !dbPath.endsWith(".docx")) {
                throw new Error(`Invalid file extension. Expected .docx`);
            }

            // ==================== DELETE OLD PHYSICAL FILE ====================
            const operation = await Operation.findOne({ Operation_Ref_No: operationRef })
                .select("documents")
                .lean();

            const oldDoc = operation?.documents?.find(
                (doc) => doc.documentType === DOCUMENT_TYPE
            );

            if (oldDoc?.filePath) {
                try {
                    const oldFullPath = path.join(process.cwd(), "public", oldDoc.filePath);
                    if (fs.existsSync(oldFullPath)) {
                        fs.unlinkSync(oldFullPath);
                        console.log(`🗑️ Deleted old document file: ${oldFullPath}`);
                    }
                } catch (deleteError) {
                    console.warn("⚠️ Failed to delete old file:", deleteError.message);
                }
            }

            // ==================== REMOVE OLD DOCUMENT ENTRY FROM DB ====================
            if (operation) {
                await Operation.updateOne(
                    { Operation_Ref_No: operationRef },
                    { $pull: { documents: { documentType: DOCUMENT_TYPE } } }
                );
            }

            // ==================== ADD NEW DOCUMENT ENTRY WITH GENERATING STATUS ====================
            if (operation) {
                const documentEntry = {
                    documentType: DOCUMENT_TYPE,
                    filePath: dbPath,
                    checklistId: form._id,
                    source: "SYSTEM_GENERATED",
                    status: "GENERATING",
                    uploadedAt: new Date(),
                };

                await Operation.updateOne(
                    { Operation_Ref_No: operationRef },
                    { $push: { documents: documentEntry } }
                );

                console.log("💾 Document entry added to StsOperation", { operationRef, filePath: dbPath });
            }

            // ==================== GENERATE DOCX DOCUMENT ====================
            await generateOpsOfd020Doc(form, fullPath);
            console.log("✅ Document generated successfully", { fullPath });

            // ==================== UPDATE DOCUMENT STATUS TO GENERATED ====================
            if (operation) {
                const updateResult = await Operation.updateOne(
                    {
                        Operation_Ref_No: operationRef,
                        "documents.documentType": DOCUMENT_TYPE,
                    },
                    {
                        $set: {
                            "documents.$.status": "GENERATED",
                            "documents.$.filePath": dbPath,
                            "documents.$.uploadedAt": new Date(),
                        },
                    }
                );

                if (updateResult.matchedCount === 0) {
                    console.warn("⚠️ No document entry found to update");
                }
            }

            console.log("🎉 Job completed successfully");
        } catch (error) {
            console.error("❌ Job Failed:", error.message);
            console.error("Error stack:", error.stack);

            // Update document status to FAILED
            try {
                await Operation.updateOne(
                    {
                        Operation_Ref_No: operationRef,
                        "documents.documentType": DOCUMENT_TYPE,
                    },
                    {
                        $set: {
                            "documents.$.status": "FAILED",
                        },
                    }
                );
            } catch (updateError) {
                console.error("Failed to update document status to FAILED:", updateError);
            }

            throw error;
        }
    });
}
