import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { connectDB } from "../lib/config/connection.js";
import { getAgenda } from "../jobs/agenda/agenda.js";
import { registerJobs } from "../jobs/agenda/registerJobs.js";
import { attachDocxJobRetryHandler } from "../jobs/agenda/docxJobRetry.js";

async function startWorker() {
    try {
        await connectDB();
        console.log("✅ Mongo Connected (Worker)");

        const agenda = await getAgenda();

        // ==================== REGISTER ALL JOB DEFINITIONS ====================
        await registerJobs();
        console.log("✅ Job definitions registered");

        // ==================== CLEAN UP STALE LOCKS ====================
        // When the worker crashes or restarts, jobs may remain "locked" in MongoDB.
        // These orphaned locks prevent the new worker from picking up those jobs.
        // We clear ALL locks on startup so the worker can reprocess them.
        try {
            const collection = agenda._collection;
            const staleResult = await collection.updateMany(
                { lockedAt: { $ne: null } },
                { $set: { lockedAt: null } }
            );
            if (staleResult.modifiedCount > 0) {
                console.log(`🔓 Cleared ${staleResult.modifiedCount} stale job lock(s) from previous run`);
            }
        } catch (err) {
            console.warn("⚠️ Could not clear stale locks:", err.message);
        }

        // ==================== RESCUE STUCK JOBS ====================
        // Jobs where nextRunAt is null (broken jobs) — set them to run now
        try {
            const collection = agenda._collection;
            const stuckResult = await collection.updateMany(
                {
                    nextRunAt: null,
                    lastFinishedAt: null, // Not yet completed
                    failedAt: null,       // Not failed
                },
                { $set: { nextRunAt: new Date() } }
            );
            if (stuckResult.modifiedCount > 0) {
                console.log(`🔄 Rescued ${stuckResult.modifiedCount} stuck job(s) with null nextRunAt`);
            }
        } catch (err) {
            console.warn("⚠️ Could not rescue stuck jobs:", err.message);
        }

        // ==================== EVENT LISTENERS ====================
        agenda.on("ready", () => {
            console.log("✅ Agenda is ready");
        });

        agenda.on("start", (job) => {
            console.log(`▶️ Job started: ${job.attrs.name} (ID: ${job.attrs._id})`);
        });

        agenda.on("success", (job) => {
            console.log(`✅ Job completed: ${job.attrs.name} (ID: ${job.attrs._id})`);
        });

        agenda.on("fail", (err, job) => {
            console.error(`❌ Job failed: ${job?.attrs?.name || "unknown"} (ID: ${job?.attrs?._id || "unknown"})`, err.message);
        });

        // STS DOCX jobs (generate-*): Agenda 5 has no define() backoff — reschedule after failure (see docxJobRetry.js)
        attachDocxJobRetryHandler(agenda);

        // ==================== START PROCESSING ====================
        await agenda.start();
        console.log("🚀 Worker started — processing jobs every 2 seconds");

        // ==================== PERIODIC HEALTH CHECK ====================
        // Every 30 seconds, check for orphaned/stuck jobs and recover them
        setInterval(async () => {
            try {
                const collection = agenda._collection;
                const now = new Date();

                // 1. Count ready jobs (should be 0 if worker is healthy)
                const readyJobs = await collection.countDocuments({
                    nextRunAt: { $lte: now },
                    lockedAt: null,
                });

                // 2. Count locked (running) jobs
                const lockedJobs = await collection.countDocuments({
                    lockedAt: { $ne: null },
                });

                // 3. Clear locks older than 5 minutes (crashed jobs)
                const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
                const staleResult = await collection.updateMany(
                    { lockedAt: { $lt: fiveMinAgo } },
                    { $set: { lockedAt: null, nextRunAt: new Date() } }
                );

                if (staleResult.modifiedCount > 0) {
                    console.log(`🔓 Auto-recovered ${staleResult.modifiedCount} stale lock(s)`);
                }

                // Only log if there are pending items
                if (readyJobs > 0 || lockedJobs > 0) {
                    console.log(`📋 Health: ${readyJobs} ready, ${lockedJobs} running`);
                }
            } catch (err) {
                console.error("Health check error:", err.message);
            }
        }, 30000); // Every 30 seconds

        // ==================== GRACEFUL SHUTDOWN ====================
        const shutdown = async (signal) => {
            console.log(`\n⏹️ Received ${signal}, shutting down gracefully...`);
            await agenda.stop();
            console.log("✅ Worker stopped");
            process.exit(0);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

    } catch (err) {
        console.error("❌ Worker Start Error:", err);
        process.exit(1);
    }
}

startWorker();
