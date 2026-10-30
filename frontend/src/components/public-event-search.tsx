"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

type SearchPhoto = {
  id: string;
  access_token: string;
};

type SearchResult = {
  session_id: string;
  match_count: number;
  photos: SearchPhoto[];
};

type Props = {
  slug: string;
  ready: boolean;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://eventlens-api.onrender.com/api")
  .trim()
  .replace(/\/+$/, "");

export default function PublicEventSearch({ slug, ready }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Matching your photos...");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const [eventActive, setEventActive] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<"selfie" | "moment">("selfie");
  const [momentQuery, setMomentQuery] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (selfiePreviewUrl) {
        URL.revokeObjectURL(selfiePreviewUrl);
      }
    };
  }, [selfiePreviewUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;

    video.srcObject = stream;
    const markReady = () => setCameraReady(true);
    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("canplay", markReady);
    if (video.readyState >= 3) {
      setCameraReady(true);
    }
    video.play().catch((err) => {
      setError(err instanceof Error ? err.message : "Camera preview could not start.");
    });

    return () => {
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("canplay", markReady);
      video.srcObject = null;
    };
  }, [cameraOpen, facingMode]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraReady(false);
  }

  function setOptimizedSelfie(nextFile: File | null) {
    if (selfiePreviewUrl) {
      URL.revokeObjectURL(selfiePreviewUrl);
    }
    setFile(nextFile);
    setSelfiePreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setResult(null);
    setError(null);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    stopCamera();

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(selectedFile);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                setOptimizedSelfie(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
              } else {
                setOptimizedSelfie(selectedFile);
              }
            },
            "image/jpeg",
            0.88
          );
        } else {
          setOptimizedSelfie(selectedFile);
        }
      };
      img.onerror = () => {
        setOptimizedSelfie(selectedFile);
      };
      img.src = objectUrl;
    } catch {
      setOptimizedSelfie(selectedFile);
    }
  }

  async function startCamera(mode: "user" | "environment" = facingMode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported in this browser. Please use 'Upload Photo' instead.");
      return;
    }

    setCameraStarting(true);
    setError(null);
    stopCamera();

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setFacingMode(mode);
      setCameraOpen(true);
      setTimeout(() => {
        cameraContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Camera permission denied. Please allow camera access in browser settings or upload a photo."
      );
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  function toggleCameraFlip() {
    const nextMode = facingMode === "user" ? "environment" : "user";
    startCamera(nextMode);
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!cameraReady || !video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is starting up. Please wait a second and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    let width = video.videoWidth;
    let height = video.videoHeight;
    const maxDim = 1200;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture selfie from video.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to create selfie image.");
          return;
        }
        setOptimizedSelfie(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.88
    );
  }

  async function ensureEventActive() {
    try {
      const res = await fetch(`${API_URL}/public/events/${slug}`, { cache: "no-store" });
      if (!res.ok) {
        setEventActive(false);
        setResult(null);
        stopCamera();
        return false;
      }
      setEventActive(true);
      return true;
    } catch {
      return true;
    }
  }

  async function handleMomentSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = momentQuery.trim();
    if (query.length < 2) {
      setError("Please enter at least 2 characters to search moments.");
      return;
    }

    setLoading(true);
    setLoadingMsg("Searching event moments...");
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/public/events/${slug}/search-moments?q=${encodeURIComponent(query)}`
      );
      const body = await res.json().catch(() => ({ detail: "Search failed" }));
      if (!res.ok) {
        throw new Error(body.detail ?? "Moment search failed.");
      }
      setResult(body as SearchResult);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Moment search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please take a selfie or upload a photo first.");
      return;
    }
    if (!consentChecked) {
      setError("Please check the consent box to proceed with face matching.");
      return;
    }

    setLoading(true);
    setLoadingMsg("Scanning event gallery with AI...");
    setError(null);

    await ensureEventActive();

    const formData = new FormData();
    formData.append("guest_name", guestName.trim() || "Guest");
    formData.append("privacy_consent", "true");
    formData.append("selfie", file);

    try {
      let res: Response | null = null;
      let lastErr: Error | null = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) {
            setLoadingMsg("Connecting to AI engine... Retrying in a moment.");
            await new Promise((r) => setTimeout(r, 2000));
          }
          res = await fetch(`${API_URL}/public/events/${slug}/search`, {
            method: "POST",
            body: formData,
          });
          if (res) break;
        } catch (fetchErr) {
          lastErr = fetchErr instanceof Error ? fetchErr : new Error("Network request failed");
        }
      }

      if (!res) {
        throw (
          lastErr ||
          new Error("Could not connect to search server. Please check your connection and try again.")
        );
      }

      const body = await res.json().catch(() => ({ detail: "Search response error" }));
      if (!res.ok) {
        throw new Error(body.detail ?? "No face found or search failed. Please try a clearer selfie.");
      }

      const searchResult = body as SearchResult;
      setResult(searchResult);
      window.dispatchEvent(new Event(`novusgrid:search-complete:${slug}`));
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error
          ? err.message
          : "Photo search could not be completed. Please try a clearer selfie."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!eventActive) {
    return (
      <div className="novus-card p-6 sm:p-8 text-center bg-white border border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Event Inactive</span>
        <h2 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">
          This event gallery has ended or was archived.
        </h2>
        <p className="mt-3 text-sm text-slate-600">Please contact the photography team for assistance.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-6">
      <div className="novus-card p-4 sm:p-6 lg:p-8 bg-white border border-slate-200 shadow-sm w-full max-w-full overflow-hidden">
        {/* Header with Title and Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                ⚡ Instant Face Match
              </span>
              <span
                className={`novus-badge text-[11px] font-bold ${
                  ready
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {ready ? "● Search Ready" : "⏳ Indexing"}
              </span>
            </div>
            <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Find Your Photos
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setSearchMode("selfie")}
              className={`py-2 px-3 rounded-lg transition ${
                searchMode === "selfie"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🤳 By Selfie
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("moment")}
              className={`py-2 px-3 rounded-lg transition ${
                searchMode === "moment"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🔍 By Scene
            </button>
          </div>
        </div>

        {searchMode === "moment" ? (
          <div className="pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Search Event Moments & Scenes
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={momentQuery}
                  onChange={(e) => setMomentQuery(e.target.value)}
                  placeholder="e.g. cake cutting, stage, couple"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="button"
                  onClick={handleMomentSearch}
                  disabled={loading || !ready}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500">
              <span>Popular suggestions:</span>
              {["cake", "couple", "stage", "dance", "family"].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setMomentQuery(sug)}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
                >
                  #{sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-4">
            {/* Primary Action: Camera & Upload (Right At Top!) */}
            <div ref={cameraContainerRef} className="space-y-3">
              {!cameraOpen && !selfiePreviewUrl && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => startCamera("user")}
                    disabled={cameraStarting || loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-98 transition"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>{cameraStarting ? "Opening Camera..." : "📸 Take a Selfie"}</span>
                  </button>

                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>📁 Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}

              {/* Viewfinder: Right At The Top */}
              {cameraOpen && (
                <div className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-black relative w-full shadow-lg">
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className={`w-full max-h-[55vh] object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
                  />

                  {/* Face Guide Oval */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-[min(50vw,13rem)] aspect-[3/4] rounded-full border-2 border-dashed border-white/70 shadow-2xl" />
                  </div>

                  {/* Camera Controls Floating Bar */}
                  <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 rounded-xl">
                    <button
                      type="button"
                      onClick={toggleCameraFlip}
                      className="rounded-full bg-white/20 backdrop-blur-md p-2.5 text-white hover:bg-white/30 transition text-xs font-semibold"
                      title="Switch Camera"
                    >
                      🔄 Flip
                    </button>

                    <button
                      type="button"
                      onClick={captureSelfie}
                      disabled={!cameraReady}
                      className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/40 hover:bg-blue-500 active:scale-95 transition"
                    >
                      📸 Snap Photo
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-full bg-white/20 backdrop-blur-md px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-white/30 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Selfie Ready Preview Card */}
              {selfiePreviewUrl && (
                <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-sm">
                  <img
                    src={selfiePreviewUrl}
                    alt="Selfie preview"
                    className="h-16 w-16 rounded-xl object-cover border-2 border-white shadow"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <span>✓</span>
                      <span>Selfie Ready</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Sharp facial scan ready for matching.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCamera("user")}
                      className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Retake
                    </button>
                    <label className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer">
                      Change
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Simple Optional Name Field (Zero Friction!) */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Your Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Faisal Khan"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {/* Consent Notice */}
            <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                I consent to temporary face matching for this event. Selfies are processed in RAM and never stored.
              </span>
            </label>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs sm:text-sm font-medium text-red-700 flex items-start gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Big Search Button */}
            <button
              type="submit"
              disabled={loading || !file || !consentChecked}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{loadingMsg}</span>
                </>
              ) : (
                <span>🔍 Find My Photographs</span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Results Section */}
      {result && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="novus-badge bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                Match Discovery
              </span>
              <h3 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {result.match_count} {result.match_count === 1 ? "Photograph" : "Photographs"} Found
              </h3>
            </div>
            <p className="text-[11px] font-semibold text-slate-500">Tap photo to view & download</p>
          </div>

          {result.photos.length === 0 ? (
            <div className="novus-card p-8 sm:p-12 text-center bg-white border border-slate-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl mb-3">
                🔍
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">No Matching Photographs Found</h4>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                We couldn&apos;t match your face in the event archive. Try retaking a well-lit selfie looking directly at the camera without glasses or caps.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4">
              {result.photos.map((photo, index) => {
                const accessToken = encodeURIComponent(photo.access_token);
                const thumbUrl = `${API_URL}/public/events/${slug}/photos/${photo.id}/thumbnail?token=${accessToken}`;
                const downloadUrl = `${API_URL}/public/events/${slug}/photos/${photo.id}/download?token=${accessToken}`;

                return (
                  <article
                    key={photo.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm transition hover:shadow-md cursor-pointer aspect-[4/3]"
                    onClick={() => setActiveLightboxIndex(index)}
                  >
                    <img
                      src={thumbUrl}
                      alt="Matched event moment"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                      <a
                        href={downloadUrl}
                        onClick={(e) => e.stopPropagation()}
                        download
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition"
                      >
                        Download
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Lightbox Modal */}
      {activeLightboxIndex !== null && result && result.photos[activeLightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <button
            type="button"
            onClick={() => setActiveLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/90 hover:text-white p-2 rounded-full bg-white/10 text-sm font-bold z-10"
          >
            ✕ Close
          </button>

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={`${API_URL}/public/events/${slug}/photos/${result.photos[activeLightboxIndex].id}/thumbnail?token=${encodeURIComponent(
                result.photos[activeLightboxIndex].access_token
              )}`}
              alt="Full preview"
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
              <a
                href={`${API_URL}/public/events/${slug}/photos/${result.photos[activeLightboxIndex].id}/download?token=${encodeURIComponent(
                  result.photos[activeLightboxIndex].access_token
                )}`}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition"
              >
                Download Original High-Res
              </a>
              <span className="text-xs text-slate-400">
                Photo {activeLightboxIndex + 1} of {result.photos.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
