"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (url: string) => void;
  folder: "products" | "categories" | "orders" | "brands";
  label?: string;
  fallback?: string;
};

export function ImageUploadField({
  value,
  onChange,
  folder,
  label = "Image",
  fallback = "/images/product-sparklers.png",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const preview = value || fallback;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Upload failed");
        setUploading(false);
        return;
      }
      onChange(data.url);
    } catch {
      setError("Network error while uploading");
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-navy">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-muted">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-cover"
            sizes="112px"
            unoptimized={preview.startsWith("/uploads/")}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-navy px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            {value && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onChange(fallback)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            JPG, PNG, WEBP or GIF · max 2 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <label className="block text-xs font-semibold text-muted">
            Or paste image URL
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={fallback}
              className="mt-1 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm text-navy outline-none focus:border-amber focus:bg-surface"
            />
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
