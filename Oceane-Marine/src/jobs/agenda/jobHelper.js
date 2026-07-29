import mongoose from "mongoose";

/**
 * Helper function to create and schedule an Agenda job immediately.
 * 
 * IMPORTANT: Instead of using Agenda's own MongoDB client (which has a 
 * mongodb@4.17.2 vs 7.0.0 version mismatch in Next.js), we write directly
 * to the agendaJobs collection using Mongoose. This ensures the job is
 * persisted reliably and the worker picks it up on its next polling cycle.
 * 
 * @param {Agenda|null} agenda - Agenda instance (ignored — kept for backward compat)
 * @param {string} jobName - Job name (e.g., "generate-ops-ofd-001")
 * @param {object} jobData - Job data
 * @returns {Promise<object>} - The created job document
 */
export async function createAndScheduleJob(agenda, jobName, jobData) {
    try {
        // Use Mongoose's underlying connection to write directly to agendaJobs
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error("Mongoose connection not ready — cannot queue job");
        }

        const collection = db.collection("agendaJobs");

        const now = new Date();
        const jobDoc = {
            name: jobName,
            data: jobData,
            type: "normal",
            priority: 0,
            nextRunAt: new Date(now.getTime() - 1000), // 1s in the past → picked up immediately
            lastModifiedBy: null,
            lockedAt: null,
            lastRunAt: null,
            lastFinishedAt: null,
            failedAt: null,
            failReason: null,
            failCount: 0,
            disabled: false,
        };

        const result = await collection.insertOne(jobDoc);

        console.log(
            `🔄 Job queued (via Mongoose): ${jobName} (ID: ${result.insertedId})`,
            jobData
        );

        return { _id: result.insertedId, ...jobDoc };
    } catch (error) {
        console.error(`❌ Error creating job ${jobName}:`, error);
        throw error;
    }
}
