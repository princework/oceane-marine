import STSStandingOrder from "../../lib/mongodb/models/operation-sts-checklist/OPS-OFD-011.js";
import Operation from "../../lib/mongodb/models/sts-documentation/StsOperation.js";
import { generateOpsOfd011Doc } from "../services/pdf/OPS-OFD-011.js";
import { getPdfStoragePath } from "../services/pdf/pdfStorage.js";
import fs from "node:fs";
import path from "node:path";

const DOCUMENT_TYPE = "OPS-OFD-011";

export function defineOpsOfd011Job(agenda) {
    agenda.define("generate-ops-ofd-011", async (job) => {
        const { checklistId, operationRef } = job.attrs.data;

        if (!checklistId || !operationRef) {
            throw new Error("Missing checklistId or operationRef in job data");
        }

        try {
            console.log("🚀 Starting OPS-OFD-011 document generation job", { checklistId, operationRef });

            // ==================== ENSURE MONGODB CONNECTION ====================
            const mongoose = await import("mongoose");
            if (mongoose.default.connection.readyState !== 1) {
                throw new Error("MongoDB connection is not ready");
            }

            // ==================== FETCH STANDING ORDER ====================
            const standingOrder = await STSStandingOrder.findById(checklistId).lean();
            if (!standingOrder) {
                throw new Error(`Standing order not found with ID: ${checklistId}`);
            }

            if (!standingOrder.sequenceNumber) {
                throw new Error("Standing order missing sequenceNumber");
            }

            console.log(`📄 Generating document with Revision: ${standingOrder.documentInfo?.revisionNo || "N/A"}`, {
                checklistId,
                operationRef,
                sequenceNumber: standingOrder.sequenceNumber,
            });

            // ==================== GENERATE FILE PATHS (CREATES FOLDERS) ====================
            const fileName = `${DOCUMENT_TYPE}-${standingOrder.sequenceNumber}.docx`;
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
                        console.log(`🗑️ Deleted old document: ${oldFullPath}`);
                    }
                } catch (deleteError) {
                    console.warn("⚠️ Failed to delete old document file:", deleteError.message);
                }
            }

            // ==================== ENSURE DIRECTORY EXISTS ====================
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
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
                checklistId: standingOrder._id,
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
            await generateOpsOfd011Doc(standingOrder, fullPath);
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
                console.log("✅ Document verified in database", {
                    documentType: savedDoc.documentType,
                    filePath: savedDoc.filePath,
                    status: savedDoc.status,
                });
            } else {
                console.warn("⚠️ Document not found in database after generation");
            }

            console.log("🎉 OPS-OFD-011 document generation job completed successfully");
        } catch (error) {
            console.error("❌ OPS-OFD-011 document generation job failed:", error);

            // Update document status to FAILED if operation exists
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
