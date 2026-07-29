import STSDeclaration from "../../lib/mongodb/models/operation-sts-checklist/DeclarationOfSea.js";
import Operation from "../../lib/mongodb/models/sts-documentation/StsOperation.js";
import { generateDeclarationOfSeaDoc } from "../services/pdf/OPS-OFD-005E.js";
import { getPdfStoragePath } from "../services/pdf/pdfStorage.js";
import fs from "node:fs";
import path from "node:path";

const DOCUMENT_TYPE = "OPS-OFD-005E";

export function defineDeclarationOfSeaJob(agenda) {
    agenda.define("generate-declaration-of-sea", async (job) => {
        const { checklistId, operationRef } = job.attrs.data;

        if (!checklistId || !operationRef) {
            throw new Error("Missing checklistId or operationRef in job data");
        }

        try {
            console.log("🚀 Starting OPS-OFD-005E document generation job", { checklistId, operationRef });

            // ==================== ENSURE MONGODB CONNECTION ====================
            const mongoose = await import("mongoose");
            if (mongoose.default.connection.readyState !== 1) {
                throw new Error("MongoDB connection is not ready");
            }

            // ==================== FETCH DECLARATION ====================
            const declaration = await STSDeclaration.findById(checklistId);
            if (!declaration) {
                throw new Error(`Declaration not found with ID: ${checklistId}`);
            }

            if (!declaration.sequenceNumber) {
                throw new Error("Declaration missing sequenceNumber");
            }

            console.log(`📄 Generating document with Revision: ${declaration.revisionNo || "N/A"}`, {
                checklistId,
                operationRef,
                sequenceNumber: declaration.sequenceNumber,
            });

            // ==================== GENERATE FILE PATHS (CREATES FOLDERS) ====================
            const fileName = `${DOCUMENT_TYPE}-${declaration.sequenceNumber}.docx`;
            const { fullPath, dbPath } = await getPdfStoragePath(operationRef, fileName);

            console.log(`📁 File paths generated:`, { fullPath, dbPath });

            // Validate file paths
            if (!fullPath.endsWith(".docx") || !dbPath.endsWith(".docx")) {
                throw new Error(`Invalid file extension. Expected .docx`);
            }

            // ==================== DELETE OLD PHYSICAL FILE ====================
            const operation = await Operation.findOne({ Operation_Ref_No: operationRef })
                .select("documents")
                .lean();

            if (!operation) {
                console.warn(`⚠️ StsOperation not found for Operation_Ref_No: "${operationRef}". Document will still be generated.`);
            } else {
                console.log(`✅ Found StsOperation for "${operationRef}" with ${operation.documents?.length || 0} existing documents`);
            }

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
                const pullResult = await Operation.updateOne(
                    { Operation_Ref_No: operationRef },
                    { $pull: { documents: { documentType: DOCUMENT_TYPE } } }
                );
                console.log(`🗑️ Pull old doc entry: matched=${pullResult.matchedCount}, modified=${pullResult.modifiedCount}`);
            }

            // ==================== ADD NEW DOCUMENT ENTRY WITH GENERATING STATUS ====================
            if (operation) {
                const documentEntry = {
                    documentType: DOCUMENT_TYPE,
                    filePath: dbPath,
                    checklistId: declaration._id,
                    source: "SYSTEM_GENERATED",
                    status: "GENERATING",
                    uploadedAt: new Date(),
                };

                const pushResult = await Operation.updateOne(
                    { Operation_Ref_No: operationRef },
                    { $push: { documents: documentEntry } }
                );

                console.log(`📊 Push result: matched=${pushResult.matchedCount}, modified=${pushResult.modifiedCount}`);

                if (pushResult.matchedCount === 0) {
                    console.warn(`⚠️ Push failed - Operation_Ref_No "${operationRef}" not found`);
                } else if (pushResult.modifiedCount === 0) {
                    console.warn(`⚠️ Push matched but did not modify - possible schema validation issue`);
                } else {
                    console.log("💾 Document entry added to StsOperation", { operationRef, filePath: dbPath });
                }
            }

            // ==================== GENERATE DOCX DOCUMENT ====================
            await generateDeclarationOfSeaDoc(declaration, fullPath);
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
                    console.warn("⚠️ No document entry found to update status - adding with GENERATED status directly");
                    await Operation.updateOne(
                        { Operation_Ref_No: operationRef },
                        {
                            $push: {
                                documents: {
                                    documentType: DOCUMENT_TYPE,
                                    filePath: dbPath,
                                    checklistId: declaration._id,
                                    source: "SYSTEM_GENERATED",
                                    status: "GENERATED",
                                    uploadedAt: new Date(),
                                },
                            },
                        }
                    );
                } else {
                    console.log(`📊 Update status result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
                }

                // ==================== VERIFY DOCUMENT WAS SAVED ====================
                const operationForVerification = await Operation.findOne({ Operation_Ref_No: operationRef })
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
                    console.error("   All documents in operation:", operationForVerification?.documents?.map(d => d.documentType));
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
