import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getSessionUser } from "@/lib/auth/sessions";
import { rateLimit } from "@/lib/rate-limiter";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads", "avatars");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Single source of truth for the accepted MIME types and the file
// extension each one is stored with. The extension used on disk is
// always derived from this map, never from the client-supplied file
// name, which removes the path-traversal / arbitrary-extension vector.
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Magic-number signatures used to verify the actual file content
// matches the claimed (client-supplied) MIME type.
function matchesMagicNumber(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/gif":
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      );
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimitResponse = rateLimit(request, user.id, "upload-avatar");
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const extension = MIME_TO_EXTENSION[file.type];
    if (!extension) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Verify the actual bytes match the claimed MIME type, since
    // file.type is client-supplied and cannot be trusted on its own.
    if (!matchesMagicNumber(buffer, file.type)) {
      return NextResponse.json(
        { error: "File content does not match the declared file type." },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename. The extension is derived solely from
    // the validated MIME type map above, never from the client-supplied
    // file name.
    const fileName = `${user.id}-${Date.now()}.${extension}`;
    const filePath = join(UPLOAD_DIR, fileName);

    // Save file
    await writeFile(filePath, buffer);

    // Only once the replacement is on disk, remove this user's earlier
    // avatars so uploads don't accumulate unbounded. Doing this before the
    // write would leave user.image pointing at a deleted file if the write
    // failed. A failure here must not fail the upload.
    try {
      const existingFiles = await readdir(UPLOAD_DIR);
      const staleAvatars = existingFiles.filter(
        (name) => name.startsWith(`${user.id}-`) && name !== fileName
      );
      await Promise.all(
        staleAvatars.map((name) => unlink(join(UPLOAD_DIR, name)))
      );
    } catch (cleanupError) {
      console.error("Avatar cleanup error:", cleanupError);
    }

    // Return public URL
    const url = `/uploads/avatars/${fileName}`;

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }
}
