"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuestEventCodeSearch() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Please enter an event code or link.");
      return;
    }

    // Handle full URL paste: extract slug if user pasted https://events.novusgrid.io/event/sharma-wedding
    let slug = trimmed;
    try {
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        const url = new URL(trimmed);
        const parts = url.pathname.split("/").filter(Boolean);
        const eventIdx = parts.indexOf("event");
        if (eventIdx !== -1 && parts[eventIdx + 1]) {
          slug = parts[eventIdx + 1];
        } else if (parts.length > 0) {
          slug = parts[parts.length - 1];
        }
      }
    } catch {
      // Not a full URL, treat as raw code/slug
    }

    // Clean up slug
    slug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    if (!slug) {
      setError("Please enter a valid event code.");
      return;
    }

    router.push(`/event/${slug}`);
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-8 sm:mt-10">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-4 shadow-xl shadow-blue-900/5 border border-slate-200/80">
        <div className="flex items-center gap-2 px-2 pb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Find Event Photos by Code</span>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter Event Code (e.g. sharma-wedding)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 sm:py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 hover:shadow-blue-600/35 active:scale-95 shrink-0"
          >
            <span>Find Photos</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>

        {error && (
          <p className="mt-2 px-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between px-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          <span>No QR code needed</span>
          <span className="font-medium text-slate-500">Instant AI selfie matching</span>
        </div>
      </div>
    </div>
  );
}
