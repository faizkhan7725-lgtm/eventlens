"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { uploadEventPhotos, type Event } from "@/lib/api";

type Props = {
  event: Event;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
};

type FilePreview = {
  id: string;
  file: File;
  previewUrl: string;
  sizeFormatted: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BATCH_SIZE = 10; // Upload in mobile-friendly chunks of 10

export default function DirectPhotoUploader({
  event,
  accessToken,
  isOpen,
  onClose,
  onUploadComplete,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs on unmount or file reset
  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, [selectedFiles]);

  if (!isOpen) return null;

  function handleFilesAdded(incomingFiles: FileList | null) {
    if (!incomingFiles || incomingFiles.length === 0) return;

    setError(null);
    setSuccessCount(null);

    const validFiles: FilePreview[] = [];
    const maxBytes = 25 * 1024 * 1024; // 25MB

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        continue;
      }
      if (file.size > maxBytes) {
        setError(`"${file.name}" is larger than 25 MB and was skipped.`);
        continue;
      }

      validFiles.push({
        id: `${file.name}-${file.size}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        sizeFormatted: formatBytes(file.size),
      });
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  }

  function handleRemoveFile(id: string) {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function handleClearAll() {
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setSelectedFiles([]);
    setError(null);
    setSuccessCount(null);
  }

  async function handleStartUpload() {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccessCount(null);
    setProgress({ current: 0, total: selectedFiles.length });

    const allRawFiles = selectedFiles.map((item) => item.file);
    let uploadedSoFar = 0;

    try {
      // Chunk uploads to prevent mobile socket / payload timeouts
      for (let i = 0; i < allRawFiles.length; i += BATCH_SIZE) {
        const batch = allRawFiles.slice(i, i + BATCH_SIZE);
        await uploadEventPhotos(accessToken, event.id, batch);
        uploadedSoFar += batch.length;
        setProgress({ current: uploadedSoFar, total: allRawFiles.length });
      }

      setSuccessCount(uploadedSoFar);
      // Clean up previews
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photos. Please retry.");
    } finally {
      setUploading(false);
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4">
      {/* Container: Bottom-sheet on mobile, centered modal on desktop */}
      <div className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                Direct Upload
              </span>
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[180px] sm:max-w-xs">
                {event.name}
              </span>
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
              Upload Event Photos
            </h3>
          </div>

          <button
            onClick={onClose}
            disabled={uploading}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start gap-2">
              <span className="text-red-500 font-bold shrink-0">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {successCount !== null && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <span className="text-2xl">🎉</span>
              <h4 className="mt-1 text-sm font-bold text-emerald-900">
                {successCount} Photos Uploaded Successfully!
              </h4>
              <p className="mt-0.5 text-xs text-emerald-700">
                Face indexing has started automatically in the background.
              </p>
            </div>
          )}

          {/* Upload Progress Bar (Active during upload) */}
          {uploading && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-blue-900">
                <span>Uploading to Gallery...</span>
                <span>{progress.current} / {progress.total} photos ({percent}%)</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200/60">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-700 text-center">
                Please keep this screen open while photos are transferring.
              </p>
            </div>
          )}

          {/* Mobile Tap-to-Upload & Desktop Dropzone */}
          {!uploading && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesAdded(e.dataTransfer.files);
              }}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 transition p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFilesAdded(e.target.files)}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 text-xl">
                📸
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Tap to Select or Drag Photos Here
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Supports multiple JPEG, PNG, or WebP images up to 25 MB each.
              </p>
              <span className="mt-1 inline-flex items-center rounded-lg bg-white px-3 py-1 text-[11px] font-bold text-blue-700 border border-slate-200 shadow-sm">
                📱 Camera / Gallery Picker
              </span>
            </div>
          )}

          {/* Selected Files Preview List */}
          {selectedFiles.length > 0 && !uploading && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Selected Photos ({selectedFiles.length})</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-red-600 hover:underline"
                >
                  Clear All
                </button>
              </div>

              {/* Responsive Grid of Thumbnails */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-1">
                      <p className="text-[10px] text-white font-medium truncate">
                        {item.sizeFormatted}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(item.id);
                      }}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white text-[10px] hover:bg-red-600 transition"
                      aria-label="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile-Friendly Sticky Footer */}
        <div className="border-t border-slate-200 px-5 py-3.5 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          >
            {successCount !== null ? "Done" : "Cancel"}
          </button>

          {selectedFiles.length > 0 && !uploading && (
            <button
              type="button"
              onClick={handleStartUpload}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
            >
              <span>Upload {selectedFiles.length} Photos</span>
              <span>➔</span>
            </button>
          )}

          {successCount !== null && (
            <button
              type="button"
              onClick={() => {
                setSuccessCount(null);
                fileInputRef.current?.click();
              }}
              className="flex-1 sm:flex-none rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              Upload More Photos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
