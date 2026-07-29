import fs from "node:fs";
import path from "node:path";

/**
 * Load a signature image from any supported storage format and return
 * a Buffer ready for embedding in a DOCX `ImageRun`.
 *
 * Supported formats (tried in order):
 *   1. data:image/… base64 data-URI
 *   2. Raw base64 string (frontend strips data: prefix)
 *   3. Full HTTP(S) URL → extract pathname → read from public/
 *   4. Relative file path (e.g. /signature/operations/…) → read from public/
 *
 * @param {string|null|undefined} imageValue — stored signature value
 * @param {string} [label] — optional label for log messages
 * @returns {Buffer|null}
 */
export function loadSignatureImage(imageValue, label = "signature") {
    if (!imageValue || typeof imageValue !== "string") return null;

    try {
        if (imageValue.startsWith("data:image")) {
            const base64Data = imageValue.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            if (buffer.length > 0) return buffer;
        }

        if (
            imageValue.length > 100 &&
            !imageValue.startsWith("/") &&
            !imageValue.startsWith("http") &&
            !imageValue.startsWith("data:")
        ) {
            try {
                const buffer = Buffer.from(imageValue, "base64");
                if (buffer.length > 10 && (buffer[0] === 0x89 || buffer[0] === 0xFF)) {
                    return buffer;
                }
            } catch { /* not valid base64 */ }
        }

        let imagePath = imageValue;

        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
            try {
                imagePath = new URL(imagePath).pathname;
            } catch {
                return null;
            }
        }

        if (imagePath.startsWith("/") || imagePath.startsWith("signature")) {
            const absPath = path.join(process.cwd(), "public", imagePath);
            if (fs.existsSync(absPath)) {
                return fs.readFileSync(absPath);
            }
            console.warn(`[DOCX] Signature file not found for ${label}: ${absPath}`);
        }
    } catch (err) {
        console.error(`[DOCX] Error loading signature for ${label}:`, err.message);
    }

    return null;
}
