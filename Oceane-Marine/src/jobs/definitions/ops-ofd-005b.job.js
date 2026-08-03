import STSChecklist6AB from "../../lib/mongodb/models/operation-sts-checklist/OPS-OFD-005B.js";
import Operation from "../../lib/mongodb/models/sts-documentation/StsOperation.js";
import { generateOpsOfd005bDoc } from "../services/pdf/OPS-OFD-005B.js";
import { getPdfStoragePath } from "../services/pdf/pdfStorage.js";
import fs from "node:fs";
import path from "node:path";

const DOCUMENT_TYPE = "OPS-OFD-005B";

export function defineOpsOfd005bJob(agenda) {
    agenda.define("generate-ops-ofd-005b", async (job) => {
        const { checklistId, operationRef } = job.attrs.data;

        if (!checklistId || !operationRef) {
            throw new Error("Missing checklistId or operationRef in job data");
        }

        try {
            console.log("🚀 Starting OPS-OFD-005B document generation job", { checklistId, operationRef });

            // ==================== ENSURE MONGODB CONNECTION ====================
            const mongoose = await import("mongoose");
            if (mongoose.default.connection.readyState !== 1) {
                throw new Error("MongoDB connection is not ready");
            }

            // ==================== FETCH CHECKLIST ====================
            const checklist = await STSChecklist6AB.findById(checklistId).lean();
            if (!checklist) {
                throw new Error(`Checklist not found with ID: ${checklistId}`);
            }

            if (!checklist.sequenceNumber) {
                throw new Error("Checklist missing sequenceNumber");
            }

            console.log(`📄 Generating document with Revision: ${checklist.documentInfo?.revisionNo || "N/A"}`, {
                checklistId,
                operationRef,
                sequenceNumber: checklist.sequenceNumber,
            });

            // Debug: Log checklist data structure
            console.log("🔍 Checklist data structure:", {
                hasTransferInfo: !!checklist.transferInfo,
                transferInfoKeys: checklist.transferInfo ? Object.keys(checklist.transferInfo) : [],
                hasChecklist6A: !!checklist.checklist6A,
                checklist6AKeys: checklist.checklist6A ? Object.keys(checklist.checklist6A) : [],
                checklist6AChecksCount: checklist.checklist6A?.checks?.length || 0,
                checklist6BCount: checklist.checklist6B?.length || 0,
                hasResponsiblePersons: !!checklist.responsiblePersons,
            });

            // ==================== GENERATE FILE PATHS (CREATES FOLDERS) ====================
            const fileName = `${DOCUMENT_TYPE}-${checklist.sequenceNumber}.docx`;
            const { fullPath, dbPath } = await getPdfStoragePath(operationRef, fileName);

            console.log(`📁 File paths generated:`, { fullPath, dbPath });

            // Validate file paths
            if (!fullPath.endsWith(".docx") || !dbPath.endsWith(".docx")) {
                throw new Error(`Invalid file extension. Expected .docx`);
            }

            // ==================== DELETE OLD PHYSICAL FILE ====================
            // Find existing document to get old file path
            const operation = await Operation.findOne({ Operation_Ref_No: operationRef, isLatest: true })
                .select("documents")
                .lean();

            const oldDoc = operation?.documents?.find(
                (doc) => doc.documentType === DOCUMENT_TYPE
            );

            if (oldDoc?.filePath) {
                try {
                    // Convert DB path to full file system path
                    const oldFullPath = path.join(process.cwd(), "public", oldDoc.filePath);
                    if (fs.existsSync(oldFullPath)) {
                        fs.unlinkSync(oldFullPath);
                        console.log(`🗑️ Deleted old document file: ${oldFullPath}`);
                    }
                } catch (deleteError) {
                    console.warn("⚠️ Failed to delete old file:", deleteError.message);
                    // Continue even if delete fails
                }
            }

            // ==================== REMOVE OLD DOCUMENT ENTRY FROM DB ====================
            await Operation.updateOne(
                { Operation_Ref_No: operationRef, isLatest: true },
                { $pull: { documents: { documentType: DOCUMENT_TYPE } } }
            );

            // Add new document entry with GENERATING status
            const documentEntry = {
                documentType: DOCUMENT_TYPE,
                filePath: dbPath,
                checklistId: checklist._id,
                source: "SYSTEM_GENERATED",
                status: "GENERATING",
                uploadedAt: new Date(),
            };

            await Operation.updateOne(
                { Operation_Ref_No: operationRef, isLatest: true },
                { $push: { documents: documentEntry } }
            );

            console.log("💾 Document entry added to StsOperation", { operationRef, filePath: dbPath });

            // Generate DOCX document
            await generateOpsOfd005bDoc(checklist, fullPath);
            console.log("✅ Document generated successfully", { fullPath });

            // Update document status to GENERATED
            const updateResult = await Operation.updateOne(
                {
                    Operation_Ref_No: operationRef, isLatest: true,
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

            // Verify document was saved
            const operationForVerification = await Operation.findOne({ Operation_Ref_No: operationRef, isLatest: true })
                .select("documents")
                .lean();

            const savedDoc = operationForVerification?.documents?.find(
                (doc) => doc.documentType === DOCUMENT_TYPE
            );

            if (savedDoc) {
                console.log("✅ Verification successful - Document saved in StsOperation", {
                    documentType: savedDoc.documentType,
                    filePath: savedDoc.filePath,
                    status: savedDoc.status,
                });
            } else {
                console.error("❌ Verification failed - Document not found in StsOperation");
            }

            console.log("🎉 Job completed successfully");
        } catch (error) {
            console.error("❌ Job Failed:", error.message);
            console.error("Error stack:", error.stack);

            // Update document status to FAILED
            try {
                await Operation.updateOne(
                    {
                        Operation_Ref_No: operationRef, isLatest: true,
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
