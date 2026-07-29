import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Agenda from "agenda";

let agendaInstance = null;

/**
 * Get the Agenda instance for creating/saving jobs (API side).
 * This does NOT start processing — only the worker calls agenda.start().
 */
export async function getAgenda() {
    if (!agendaInstance) {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is not set");
        }

        console.log("🔗 Initializing Agenda...");
        
        agendaInstance = new Agenda({
            db: {
                address: process.env.MONGODB_URI,
                collection: "agendaJobs"
            },
            // These settings only matter for the worker process
            processEvery: "2 seconds",
            maxConcurrency: 20,
            defaultConcurrency: 5,
            lockLifetime: 5 * 60 * 1000, // 5 minutes (default is 10 min — reduced for faster recovery)
        });

        await agendaInstance._ready;
    }

    return agendaInstance;
}
