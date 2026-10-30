"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
  photosIndexed: number;
  ready: boolean;
  slug: string;
};

export default function PublicEventInfoCard({ name, photosIndexed, ready, slug }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideCard = () => setVisible(false);
    window.addEventListener(`novusgrid:search-complete:${slug}`, hideCard);
    // Backward compatibility with legacy event listeners
    window.addEventListener(`smartgallery:search-complete:${slug}`, hideCard);

    return () => {
      window.removeEventListener(`novusgrid:search-complete:${slug}`, hideCard);
      window.removeEventListener(`smartgallery:search-complete:${slug}`, hideCard);
    };
  }, [slug]);

  if (!visible) return null;

  return (
    <div className="lg:sticky lg:top-8 order-last lg:order-none w-full max-w-full">
      <div className="novus-card p-4 sm:p-6 lg:p-8 bg-white border border-slate-200 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Private Event Gallery
          </span>
        </div>

        <h1 className="mt-4 break-words text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
          {name}
        </h1>

        <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
          Capture or upload a quick selfie. EventLens AI will scan the event photographs and locate every picture in which you appear.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{photosIndexed}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Photos Indexed
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`} />
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {ready ? "Active" : "Indexing"}
              </p>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gallery Status
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5 space-y-3 text-xs sm:text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">1</span>
            <span>Take or upload a clear, well-lit selfie.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">2</span>
            <span>Wait a few seconds while neural matching runs.</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">3</span>
            <span>Preview in full resolution and download authorized photos.</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
          🔒 <strong>Privacy Assurance:</strong> Your selfie is analyzed in volatile memory and never stored on our servers.
        </div>
      </div>
    </div>
  );
}
