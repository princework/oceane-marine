import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connectDB } from "@/lib/config/connection";
import MOCManagementChange from "@/lib/mongodb/models/qhse-moc/mocs-managementChange";

export const runtime = "nodejs";

export async function GET(_req, { params }) {
  await connectDB();

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing MOC ID" },
        { status: 400 }
      );
    }

    const moc = await MOCManagementChange.findById(id).lean();
    if (!moc) {
      return NextResponse.json(
        { success: false, error: "MOC not found" },
        { status: 404 }
      );
    }

    // Check if there are risk assessment files
    if (!moc.riskAssessmentFiles || moc.riskAssessmentFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No attached files found for this MOC record" },
        { status: 404 }
      );
    }

    // Download the first risk assessment file (or we could return a list)
    const firstFile = moc.riskAssessmentFiles[0];
    const fileUrl = firstFile.url;

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: "File URL not found in risk assessment file" },
        { status: 404 }
      );
    }

    console.log("[MOC File Download] File URL from DB:", fileUrl);
    console.log("[MOC File Download] First file object:", JSON.stringify(firstFile, null, 2));

    // Handle HTTP URLs
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      // HTTP URL - return redirect response
      return NextResponse.redirect(fileUrl, { status: 307 });
    }

    // Normalize path separators (handle both / and \)
    const normalizedUrl = fileUrl.replace(/\\/g, "/");
    
    // Local file path - could be relative (from saveQhseFile) or absolute
    let absolutePath;
    if (path.isAbsolute(normalizedUrl)) {
      absolutePath = normalizedUrl;
    } else if (normalizedUrl.startsWith("/")) {
      // Public path (starts with /)
      absolutePath = path.resolve(process.cwd(), "public", normalizedUrl.slice(1));
    } else {
      // Relative path from process.cwd() (QHSE file storage returns paths like "uploads/QHSE/...")
      absolutePath = path.resolve(process.cwd(), normalizedUrl);
    }
    
    // Normalize the absolute path for the current OS
    absolutePath = path.normalize(absolutePath);
    
    console.log("[MOC File Download] Resolved absolute path:", absolutePath);
    console.log("[MOC File Download] Process CWD:", process.cwd());
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error("[MOC File Download] File not found at:", absolutePath);
      
      // Try alternative path resolution (in case of path separator issues)
      const altPath = path.join(process.cwd(), normalizedUrl.replace(/\//g, path.sep));
      console.log("[MOC File Download] Trying alternative path:", altPath);
      
      if (fs.existsSync(altPath)) {
        absolutePath = altPath;
        console.log("[MOC File Download] Found file at alternative path");
      } else {
        return NextResponse.json(
          { 
            success: false, 
            error: `File not found on server. Original path: ${fileUrl}, Resolved: ${absolutePath}` 
          },
          { status: 404 }
        );
      }
    }
    
    console.log("[MOC File Download] File found, reading from:", absolutePath);

    // Read file
    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = firstFile.name || firstFile.filename || path.basename(absolutePath);
    const fileExt = path.extname(fileName).toLowerCase();
    
    console.log("[MOC File Download] File name:", fileName, "Extension:", fileExt, "Size:", fileBuffer.length, "bytes");

    const contentTypeMap = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };

    const contentType = contentTypeMap[fileExt] || "application/octet-stream";
    
    // Encode filename for proper download (handle special characters)
    const encodedFileName = encodeURIComponent(fileName);

    console.log("[MOC File Download] Returning file with Content-Type:", contentType);
    console.log("[MOC File Download] File will be downloaded as:", fileName);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });

  } catch (error) {
    console.error("MOC file download error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to download file" },
      { status: 500 }
    );
  }
}
