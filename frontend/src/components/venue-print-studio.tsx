"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { Event } from "@/lib/api";

type Props = {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
};

type CardFormat = "tent" | "vertical";
type CardTheme = "navy" | "rose" | "slate" | "emerald";

const THEMES: Record<
  CardTheme,
  { name: string; bg: string; accent: string; textDark: string; textMuted: string; border: string }
> = {
  navy: {
    name: "Classic Navy",
    bg: "bg-slate-900",
    accent: "bg-blue-600 text-white",
    textDark: "text-slate-900",
    textMuted: "text-slate-500",
    border: "border-slate-200",
  },
  rose: {
    name: "Wedding Rose",
    bg: "bg-rose-950",
    accent: "bg-rose-600 text-white",
    textDark: "text-rose-950",
    textMuted: "text-rose-700/70",
    border: "border-rose-200",
  },
  slate: {
    name: "Minimal Slate",
    bg: "bg-slate-800",
    accent: "bg-slate-900 text-white",
    textDark: "text-slate-900",
    textMuted: "text-slate-500",
    border: "border-slate-200",
  },
  emerald: {
    name: "Emerald Gala",
    bg: "bg-emerald-950",
    accent: "bg-emerald-700 text-white",
    textDark: "text-emerald-950",
    textMuted: "text-emerald-700/70",
    border: "border-emerald-200",
  },
};

export default function VenuePrintStudio({ event, isOpen, onClose }: Props) {
  const [format, setFormat] = useState<CardFormat>("tent");
  const [theme, setTheme] = useState<CardTheme>("navy");
  const [studioName, setStudioName] = useState("Novus Studios");
  const [wifiDetails, setWifiDetails] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(event.public_url, {
      width: 480,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("QR Code error:", err));
  }, [event.public_url, isOpen]);

  if (!isOpen) return null;

  const currentTheme = THEMES[theme];

  function handlePrint() {
    window.print();
  }

  async function handleCopyLink() {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(event.public_url);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      setCopying(false);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.name,
          text: `Find your photos from ${event.name} with a selfie:`,
          url: event.public_url,
        });
      } catch {
        // Dismissed by user
      }
    } else {
      handleCopyLink();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm sm:p-4">
      {/* Container: Bottom-sheet on mobile, centered modal on desktop */}
      <div className="w-full sm:max-w-4xl max-h-[94vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/80 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                Venue Print Studio
              </span>
              <span className="text-xs font-semibold text-slate-500 truncate max-w-[180px] sm:max-w-xs">
                {event.name}
              </span>
            </div>
            <h3 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900">
              Table Cards & Signage Export
            </h3>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Studio Controls & Preview Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid gap-6 lg:grid-cols-12">
          
          {/* Controls Column (Mobile-first) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Format Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Card Layout
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat("tent")}
                  className={`p-3 rounded-xl border text-left transition ${
                    format === "tent"
                      ? "border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base">⛺</span>
                  <h4 className="mt-1 text-xs font-bold">Foldable Tent Card</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">2-sided for dining & reception tables.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("vertical")}
                  className={`p-3 rounded-xl border text-left transition ${
                    format === "vertical"
                      ? "border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base">📜</span>
                  <h4 className="mt-1 text-xs font-bold">Vertical Standee</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Single A5/A4 page for easel or photo booth.</p>
                </button>
              </div>
            </div>

            {/* Theme Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Color Aesthetic
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(THEMES) as CardTheme[]).map((tKey) => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setTheme(tKey)}
                    className={`py-2 px-2.5 rounded-lg border text-center transition flex items-center gap-1.5 justify-center ${
                      theme === tKey
                        ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${THEMES[tKey].bg}`} />
                    <span className="text-[11px] truncate">{THEMES[tKey].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Branding */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Studio / Photographer Name
              </label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="e.g. Captured by Studio Lens"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-blue-600"
              />
            </div>

            {/* Optional Wi-Fi Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Venue Wi-Fi Info (Optional)
              </label>
              <input
                type="text"
                value={wifiDetails}
                onChange={(e) => setWifiDetails(e.target.value)}
                placeholder="e.g. Free Wi-Fi: HotelGuest / Pass: Welcome2026"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none focus:border-blue-600"
              />
            </div>

            {/* Quick Share Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                {copying ? "✓ Link Copied!" : "🔗 Copy Public URL"}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                📱 Mobile Share
              </button>
            </div>
          </div>

          {/* Live Print Preview Canvas (Right column) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Live Venue Card Preview
            </span>

            {/* Card Render Container */}
            <div
              ref={printAreaRef}
              id="printable-venue-card"
              className="w-full max-w-md rounded-2xl border-2 border-slate-300 bg-white shadow-lg overflow-hidden flex flex-col"
            >
              {/* Card Header Strip */}
              <div className={`${currentTheme.bg} text-white px-6 py-5 text-center relative overflow-hidden`}>
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">
                  {studioName || "Official Event Gallery"}
                </span>
                <h2 className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight leading-snug">
                  {event.name}
                </h2>
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
                  <span>✨</span>
                  <span>AI Face Discovery Gallery</span>
                </div>
              </div>

              {/* QR Code and Instructions Body */}
              <div className="p-6 flex flex-col items-center text-center space-y-4 bg-white">
                <div className="p-3 rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Event Gallery QR Code" className="w-44 h-44 sm:w-52 sm:h-52" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Find Your Photos with a Selfie!
                  </h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-left max-w-xs mx-auto">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
                      <span className="text-sm">📷</span>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5">1. Scan</p>
                      <p className="text-[9px] text-slate-500">Open with camera</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
                      <span className="text-sm">🤳</span>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5">2. Snap</p>
                      <p className="text-[9px] text-slate-500">Take a quick selfie</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-center">
                      <span className="text-sm">📥</span>
                      <p className="text-[10px] font-bold text-slate-800 mt-0.5">3. Discover</p>
                      <p className="text-[9px] text-slate-500">Get your photos</p>
                    </div>
                  </div>
                </div>

                {wifiDetails && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                    📶 {wifiDetails}
                  </div>
                )}

                <p className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                  {event.public_url}
                </p>
              </div>

              {/* Fold Line guide if Tent Card */}
              {format === "tent" && (
                <div className="border-t-2 border-dashed border-slate-300 bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400">
                  ✂️ Fold here for standing table tent
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-5 py-3.5 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            <span>🖨️</span>
            <span>Print Venue Card (PDF / Printer)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
