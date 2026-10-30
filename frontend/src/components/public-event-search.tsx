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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

export default function PublicEventSearch({ slug, ready }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [selfiePreviewUrl, setSelfiePreviewUrl] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventActive, setEventActive] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<"selfie" | "moment">("selfie");
  const [momentQuery, setMomentQuery] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const guestDetailsReady =
    guestName.trim().length > 0 &&
    guestPhone.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());

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
    const markReady = () => { setCameraReady(true); };  // called by loadedmetadata or canplay, whichever fires first
    video.addEventListener("loadedmetadata", markReady);
    video.addEventListener("canplay", markReady);
    if (video.readyState >= 3) { setCameraReady(true); }
    video.play().catch((err) => {
      setError(err instanceof Error ? err.message : "Camera preview could not start.");
    });

    return () => {
      video.removeEventListener("loadedmetadata", markReady);
      video.removeEventListener("canplay", markReady);
      video.srcObject = null;
    };
  }, [cameraOpen]);

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

  function setSelfieFile(nextFile: File | null) {
    if (nextFile && nextFile.size > MAX_SELFIE_BYTES) {
      setError("Please choose a selfie image smaller than 8 MB.");
      return;
    }
    if (selfiePreviewUrl) {
      URL.revokeObjectURL(selfiePreviewUrl);
    }
    setFile(nextFile);
    setSelfiePreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setResult(null);
    setError(null);
  }

  async function startCamera() {
    if (!guestDetailsReady) {
      setError("Please enter your name, mobile number, and email address before starting the camera.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera capture is not supported in this browser. Please upload a photo file instead.");
      return;
    }

    setCameraStarting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera permission was denied.");
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  function captureSelfie() {
    const video = videoRef.current;
    if (!cameraReady || !video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is preparing. Please wait a second and try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture selfie from video stream.");
      return;
    }

    // Draw without mirror - CSS -scale-x-100 handles display mirroring only
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    // (line removed - no transform needed for capture)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Failed to generate image blob from camera.");
          return;
        }
        setSelfieFile(new File([blob], "novusgrid-selfie.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92
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
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    const checkActive = async () => {
      try {
        const res = await fetch(`${API_URL}/public/events/${slug}`, { cache: "no-store" });
        if (!cancelled && !res.ok) {
          setEventActive(false);
          setResult(null);
          stopCamera();
        }
      } catch {
        // silent
      }
    };

    const intervalId = window.setInterval(checkActive, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [slug]);

  async function handleMomentSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = momentQuery.trim();
    if (query.length < 2) {
      setError("Please enter at least 2 characters to search moments.");
      return;
    }

    setLoading(true);
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
    if (!guestDetailsReady) {
      setError("Please complete your full name, phone number, and a valid email.");
      return;
    }
    if (!file) {
      setError("Please capture or upload a selfie first.");
      return;
    }
    if (!consentChecked) {
      setError("Please review and accept the biometric consent notice to proceed.");
      return;
    }

    setLoading(true);
    setError(null);

    const active = await ensureEventActive();
    if (!active) {
      setLoading(false);
      setError("This event is currently inactive.");
      return;
    }

    const formData = new FormData();
    formData.append("guest_name", guestName.trim());
    formData.append("guest_phone", guestPhone.trim());
    formData.append("guest_email", guestEmail.trim().toLowerCase());
    formData.append("privacy_consent", "true");
    formData.append("selfie", file);

    try {
      const res = await fetch(`${API_URL}/public/events/${slug}/search`, {
        method: "POST",
        body: formData,
      });

      const body = await res.json().catch(() => ({ detail: "Search failed" }));
      if (!res.ok) {
        throw new Error(body.detail ?? "Photo search failed. Please try a different photo.");
      }

      const searchResult = body as SearchResult;
      setResult(searchResult);
      window.dispatchEvent(new Event(`novusgrid:search-complete:${slug}`));
      window.dispatchEvent(new Event(`smartgallery:search-complete:${slug}`));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!eventActive) {
    return (
      <div className="novus-card p-8 text-center bg-white border border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
          Event Inactive
        </span>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          This event gallery has ended or was archived.
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Please contact the photography team for assistance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      <form onSubmit={handleSubmit} className="novus-card p-4 sm:p-6 lg:p-8 bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">
              AI Face Discovery
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Find Your Event Photographs
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Take a front-facing selfie or upload an existing photo. Our AI matches your face against the event archive.
            </p>
          </div>
          <span
            className={`self-start novus-badge ${
              ready ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {ready ? "● Search Ready" : "⏳ Indexing Photos"}
          </span>
        </div>

        {/* Search Mode Switcher (Mobile-First) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl my-4 sm:my-6">
          <button
            type="button"
            onClick={() => setSearchMode("selfie")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
              searchMode === "selfie"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🤳</span>
            <span>Selfie Face Match</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("moment")}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition ${
              searchMode === "moment"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>🔍</span>
            <span>Search Moments</span>
          </button>
        </div>

        {searchMode === "moment" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Search Event Moments & Scenes
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={momentQuery}
                  onChange={(e) => setMomentQuery(e.target.value)}
                  placeholder="e.g. cake cutting, bride, dancing, stage"
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
              {["cake", "couple", "dance", "stage", "family"].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setMomentQuery(sug);
                  }}
                  className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
                >
                  #{sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
        {/* Guest Details Section */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">1. Guest Contact Details</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={guestName}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                required
                value={guestPhone}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="e.g. +1 (555) 019-2834"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={guestEmail}
                disabled={!eventActive || !ready || loading}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="e.g. sarah@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Selfie Capture / Upload Controls */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">2. Provide a Selfie</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!eventActive || !ready || loading || cameraStarting || !guestDetailsReady}
              onClick={cameraOpen ? stopCamera : startCamera}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{cameraOpen ? "Close Camera" : cameraStarting ? "Opening Camera..." : "Open Camera"}</span>
            </button>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400">
              <span className="truncate">{file ? file.name : "Or choose a photo file"}</span>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Browse</span>
              <input
                type="file"
                accept="image/*"
                disabled={!eventActive || !ready || loading || !guestDetailsReady}
                onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        {cameraOpen && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-black relative w-full max-w-full">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full max-h-[60vh] -scale-x-100 object-cover"
            />
            {/* Alignment Oval */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[min(48vw,12rem)] h-[min(64vw,16rem)] rounded-full border-2 border-dashed border-white/60 shadow-2xl" />
            </div>

            <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={captureSelfie}
                disabled={!cameraReady}
                className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/40 hover:bg-blue-500 transition"
              >
                📸 Snap Selfie
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full bg-white/20 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/30 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Selfie Thumbnail Preview */}
        {selfiePreviewUrl && (
          <div className="mt-5 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <img
              src={selfiePreviewUrl}
              alt="Selfie preview"
              className="h-20 w-20 rounded-lg object-cover border border-slate-200 shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Selfie Ready</p>
              <p className="truncate text-sm font-semibold text-slate-800">{file?.name}</p>
              <p className="text-xs text-slate-500">Front-facing portrait selected for neural match.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelfieFile(null)}
              className="text-xs font-bold text-slate-400 hover:text-red-600 p-2"
            >
              Remove
            </button>
          </div>
        )}

        {/* Biometric Consent */}
        <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs sm:text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
          <input
            type="checkbox"
            checked={consentChecked}
            disabled={!eventActive || !ready || loading || !guestDetailsReady}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            I explicitly consent to NovusGrid generating temporary facial geometry representations solely to identify my photos at this event. I understand my selfie is processed in volatile memory and never stored. See the{" "}
            <a href="/privacy" target="_blank" className="font-bold text-blue-600 underline">
              Biometric Privacy Notice
            </a>
            .
          </span>
        </label>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Search Submit */}
        <button
          type="submit"
          disabled={!eventActive || !ready || loading || !guestDetailsReady || !consentChecked || !file}
          className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Matching Your Photos...</span>
            </>
          ) : (
            <span>Search My Photos</span>
          )}
        </button>
        </>
        )}
      </form>

      {/* Search Results Gallery */}
      {result && (
        <section className="space-y-6 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="novus-badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                Match Discovery
              </span>
              <h3 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">
                {result.match_count} {result.match_count === 1 ? "Photograph" : "Photographs"} Found
              </h3>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Click any photo to inspect in full resolution or download.
            </p>
          </div>

          {result.photos.length === 0 ? (
            <div className="novus-card p-12 text-center bg-white">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                🔍
              </div>
              <h4 className="text-lg font-bold text-slate-900">No Matched Photographs</h4>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                We couldn&apos;t identify matching faces with high confidence. Try a well-lit photo looking directly at the camera without sunglasses or masks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4">
              {result.photos.map((photo, index) => {
                const accessToken = encodeURIComponent(photo.access_token);
                const thumbUrl = `${API_URL}/public/events/${slug}/photos/${photo.id}/thumbnail?token=${accessToken}`;
                const downloadUrl = `${API_URL}/public/events/${slug}/photos/${photo.id}/download?token=${accessToken}`;

                return (
                  <article
                    key={photo.id}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm transition hover:shadow-md cursor-pointer"
                    onClick={() => setActiveLightboxIndex(index)}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
                      <img
                        src={thumbUrl}
                        alt="Matched event moment"
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <a
                        href={downloadUrl}
                        onClick={(e) => e.stopPropagation()}
                        download
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition"
                      >
                        Download Original
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Full-Screen Lightbox Modal */}
      {activeLightboxIndex !== null && result && result.photos[activeLightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <button
            type="button"
            onClick={() => setActiveLightboxIndex(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-white/10"
          >
            ✕ Close
          </button>

          <div className="max-w-5xl max-h-[85vh] flex flex-col items-center">
            <img
              src={`${API_URL}/public/events/${slug}/photos/${result.photos[activeLightboxIndex].id}/thumbnail?token=${encodeURIComponent(
                result.photos[activeLightboxIndex].access_token
              )}`}
              alt="Full preview"
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="mt-4 flex items-center gap-4">
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
