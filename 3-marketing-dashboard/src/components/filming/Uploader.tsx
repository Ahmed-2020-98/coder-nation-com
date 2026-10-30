"use client";

import { useRef, useState, type DragEvent } from "react";
import { Film, UploadCloud, X } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

type UploadResult = { original: string; sizeBytes: number };

/** Raw POST of the File as the body (streamed to disk server-side) with real progress and a cancel button. */
function send(url: string, file: File, onProgress: (ratio: number) => void, register: (xhr: XMLHttpRequest) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("POST", url);
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => {
      let data: { error?: string; code?: string } & Partial<UploadResult> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error body */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as UploadResult);
      else reject(new ApiError(data.error ?? "فشل رفع الفيديو", xhr.status, data.code));
    };
    xhr.onerror = () => reject(new ApiError("انقطع الاتصال أثناء الرفع", 0, "network"));
    xhr.onabort = () => reject(new ApiError("اتلغى الرفع", 0, "aborted"));
    xhr.send(file);
  });
}

type Props = {
  cardId: string;
  disabled?: boolean;
  onUploaded: () => void;
  onError: (message: string) => void;
};

export function Uploader({ cardId, disabled, onUploaded, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);

  async function upload(file: File | undefined) {
    if (!file || disabled) return;
    setName(file.name);
    setProgress(0);
    try {
      await send(`/api/filming/${cardId}/footage`, file, setProgress, (xhr) => (request.current = xhr));
      onUploaded();
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "aborted")) onError(error instanceof Error ? error.message : "فشل رفع الفيديو");
    } finally {
      setProgress(null);
      request.current = null;
    }
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setOver(false);
    void upload(event.dataTransfer.files?.[0]);
  }

  const uploading = progress !== null;

  return (
    <div>
      <input ref={input} id={`footage-${cardId}`} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
      {uploading ? (
        <div className="rounded-xl border border-line p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Film aria-hidden="true" className="size-4 shrink-0 text-accent" />
              <span dir="ltr" className="truncate font-mono text-xs">{name}</span>
            </span>
            <button type="button" onClick={() => request.current?.abort()} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-ink-muted hover:text-ink">
              <X aria-hidden="true" className="size-4" />
              إلغاء
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-alt" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="تقدم رفع الفيديو">
            <div className="h-full rounded-full bg-primary-500 transition-[width] duration-200" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </div>
          <p dir="ltr" className="mt-1.5 text-end font-mono text-xs text-ink-muted">{Math.round((progress ?? 0) * 100)}%</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          onDragOver={(event) => (event.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "grid min-h-32 w-full place-items-center rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors",
            over ? "border-accent bg-accent-soft" : "border-line-strong hover:border-accent hover:bg-accent-soft",
            disabled && "cursor-not-allowed opacity-60 hover:border-line-strong hover:bg-transparent",
          )}
        >
          <span>
            <UploadCloud aria-hidden="true" className="mx-auto mb-2 size-7 text-accent" />
            <strong className="block">اسحب الفيديو هنا أو اضغط للاختيار</strong>
            <span className="text-ink-muted">MP4 أو MOV أو M4V أو WebM • بيتنسخ على جهازك بس، ومبيتبعتش لأي مكان</span>
          </span>
        </button>
      )}
    </div>
  );
}

