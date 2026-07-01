import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";

// One-time download endpoint — creates a fresh archive and serves it.
// Auto-deletes after serving.
export async function GET() {
  const projectDir = process.cwd();
  const archivePath = "/tmp/yuktaxi-download.tar.gz";

  try {
    // Clean up any previous archive
    if (existsSync(archivePath)) unlinkSync(archivePath);

    // Create archive excluding dev-only files
    execSync(
      `tar czf ${archivePath} \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.vercel' \
        --exclude='mini-services' \
        --exclude='db/*.db' \
        --exclude='*.log' \
        --exclude='.claude' \
        --exclude='.z-ai-config' \
        --exclude='tool-results' \
        --exclude='examples' \
        --exclude='skills' \
        --exclude='worklog.md' \
        --exclude='.env' \
        -C ${projectDir} .`,
      { timeout: 30000 }
    );

    if (!existsSync(archivePath)) {
      return NextResponse.json({ error: "Failed to create archive" }, { status: 500 });
    }

    // Read the archive into memory
    const { readFileSync, statSync } = await import("fs");
    const fileBuffer = readFileSync(archivePath);
    const stat = statSync(archivePath);

    // Clean up the file after reading
    try { unlinkSync(archivePath); } catch {}

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": "attachment; filename=yuktaxi-project.tar.gz",
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
