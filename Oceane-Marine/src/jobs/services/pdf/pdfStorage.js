import fs from "fs/promises";
import path from "path";

export async function getPdfStoragePath(operationRef, fileName) {

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const folder = path.join(
        process.cwd(),
        "public/upload/operation-sts-checklist",
        year,
        month,
        day
    );

    await fs.mkdir(folder, { recursive: true });

    return {
        fullPath: path.join(folder, fileName),
        dbPath: `/upload/operation-sts-checklist/${year}/${month}/${day}/${fileName}`
    };
}
