import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireSession } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (LR PDFs)
const FOLDERS = new Set(["products", "categories", "orders", "brands"]);

function extFor(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "application/pdf") return "pdf";
  return "jpg";
}

export async function POST(req: Request) {
  const { error } = await requireSession(["ADMIN"]);
  if (error)
    return apiError(error, "Forbidden", error === "FORBIDDEN" ? 403 : 401);

  try {
    const form = await req.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "products");
    const folder = FOLDERS.has(folderRaw) ? folderRaw : "products";

    if (!(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "File is required", 400);
    }
    if (!ALLOWED.has(file.type)) {
      return apiError(
        "VALIDATION_ERROR",
        "Only JPG, PNG, WEBP, GIF or PDF allowed",
        400
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return apiError("VALIDATION_ERROR", "File must be under 5 MB", 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const filename = `${stamp}-${rand}.${extFor(file.type)}`;
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);

    const url = `/uploads/${folder}/${filename}`;
    return apiOk({ url, filename, size: file.size }, 201);
  } catch (e) {
    console.error(e);
    return apiError("INTERNAL_ERROR", "Upload failed", 500);
  }
}
