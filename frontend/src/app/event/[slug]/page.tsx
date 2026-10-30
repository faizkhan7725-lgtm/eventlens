import PublicEventInfoCard from "@/components/public-event-info-card";
import PublicEventSearch from "@/components/public-event-search";
import BrandLogo from "@/components/brand-logo";
import GlobalFooter from "@/components/global-footer";
import Link from "next/link";

export const revalidate = 300; // Cache on Hostinger for 5 minutes for instant sub-second page loads

type Props = {
  params: Promise<{ slug: string }>;
};

async function getEvent(slug: string) {
  let apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "https://eventlens-api.onrender.com/api").trim().replace(/\/$/, "");
  if (!apiUrl.endsWith("/api")) {
    apiUrl = `${apiUrl}/api`;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500); // 3.5s max timeout to prevent cold boot blocking
    const res = await fetch(`${apiUrl}/public/events/${slug}`, {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return {
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: slug,
        photos_indexed: 0,
        ready: true,
      };
    }
    return res.json() as Promise<{
      name: string;
      slug: string;
      photos_indexed: number;
      ready: boolean;
    }>;
  } catch {
    // If backend is waking up from sleep, immediately return event shell so the camera UI loads in milliseconds
    return {
      name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      slug: slug,
      photos_indexed: 0,
      ready: true,
    };
  }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="novus-card max-w-md p-8 text-center bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Event Not Found
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
            This event gallery is currently unavailable.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            The event link may be inactive, archived, or typed incorrectly. Please verify the link provided by your photographer.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            Go to EventLens Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 w-full max-w-full overflow-x-hidden flex flex-col">
      <header className="border-b border-slate-200 bg-white w-full max-w-full sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-3 sm:py-3.5">
          <BrandLogo size="sm" href="/" />

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
            >
              All Events
            </Link>
            <Link
              href="/privacy"
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition shrink-0"
            >
              Privacy Notice
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-8 lg:py-10 w-full max-w-full flex-1">
        {/* Mobile: search first, info card below. Desktop: side-by-side */}
        <section className="flex flex-col lg:grid lg:gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start gap-6">
          <PublicEventSearch slug={event.slug} ready={event.ready} />
          <PublicEventInfoCard
            name={event.name}
            photosIndexed={event.photos_indexed}
            ready={event.ready}
            slug={event.slug}
          />
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
