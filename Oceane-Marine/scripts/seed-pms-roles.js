/**
 * One-time script to assign pmsRole to existing users.
 *
 * Usage:
 *   node scripts/seed-pms-roles.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const ROLE_MAP = {
  "operations@oceanemarine.com": "admin",
  "walim@oceanemarine.com": "editor",
  "cleofe@oceanemarine.com": "editor",
  "reya@oceanemarine.com": "editor",
  "meher@oceanemarine.com": "editor",
  "accounts@oceanemarine.com": "editor",
  "fujbase@oceanemarine.com": "editor",
  "captbeantsingh@oceanemarine.com": "editor",
  "captjagdeepsingh.sodhi@oceanemarine.com": "approver",
  "sunil.kurup@oceanemarine.com": "approver",
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const users = db.collection("users");

  for (const [email, role] of Object.entries(ROLE_MAP)) {
    const result = await users.updateOne(
      { email: { $regex: new RegExp(`^${email}$`, "i") } },
      { $set: { pmsRole: role } }
    );
    console.log(`${email} → ${role}: ${result.matchedCount ? "updated" : "NOT FOUND"}`);
  }

  const remaining = await users.updateMany(
    { pmsRole: { $exists: false } },
    { $set: { pmsRole: "viewer" } }
  );
  console.log(`Set ${remaining.modifiedCount} remaining users to 'viewer' (pmsRole)`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
