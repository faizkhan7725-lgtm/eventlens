import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import GuestEventCodeSearch from "@/components/guest-event-code-search";
import EcosystemSection from "@/components/ecosystem-section";
import GlobalFooter from "@/components/global-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Global Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4">
          <BrandLogo size="md" href="/" />

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#solutions" className="hover:text-blue-600 transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#ecosystem" className="hover:text-blue-600 transition-colors">NovusGrid Suite</a>
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Sign In
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition hover:bg-blue-700"
            >
              <span className="hidden sm:inline">Open&nbsp;</span>Studio
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-24 md:pb-32 w-full max-w-full">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.100),theme(colors.slate.50))] opacity-60" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-blue-700 mb-6 text-center">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <span className="truncate sm:overflow-visible">Commercial AI Event Photo Discovery for Professionals</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-6xl md:text-7xl leading-[1.12] sm:leading-[1.08] break-words">
              Turn thousands of event photos into <span className="text-blue-600">instant guest moments.</span>
            </h1>

            <p className="mt-4 sm:mt-6 text-sm sm:text-xl leading-relaxed text-slate-600 max-w-2xl mx-auto px-2">
              EventLens indexes high-resolution event galleries in seconds. Guests scan a venue QR code or enter an event code, provide one selfie, and immediately discover and download their photos.
            </p>

            {/* Guest Direct Code Search */}
            <div id="search" className="scroll-mt-24">
              <GuestEventCodeSearch />
            </div>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/admin"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 hover:shadow-blue-600/35"
              >
                <span>Launch Organizer Dashboard</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link
                href="/privacy"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
              >
                Biometric Privacy Standards
              </Link>
            </div>

            <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 sm:gap-8 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Zero App Downloads Required
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                In-Memory Ephemeral Selfies
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Sub-Second pgvector Search
              </span>
            </div>
          </div>

          {/* Interactive UI Showcase Mockup */}
          <div className="mt-16 max-w-5xl mx-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
            <div className="rounded-xl border border-slate-100 bg-slate-900 text-white p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Active Event</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-white">St. Xavier&apos;s Annual Convocation 2026</h3>
                  <p className="text-sm text-slate-400 mt-1">Organized by EventLens Studio • 4,280 photos indexed</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
                    100% Indexed
                  </span>
                  <Link
                    href="/admin"
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition"
                  >
                    Manage Event
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1</span>
                    <span className="text-blue-400 font-mono text-xs">Direct / Drive</span>
                  </div>
                  <h4 className="mt-2 text-lg font-bold text-white">Bulk Ingestion</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Organizers upload high-res archives or connect cloud storage. Photos are parsed and thumbnails prepared in real-time.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2</span>
                    <span className="text-emerald-400 font-mono text-xs">pgvector AI</span>
                  </div>
                  <h4 className="mt-2 text-lg font-bold text-white">Deep Face Indexing</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    InsightFace neural workers detect individual and group faces, generating 512-dimensional searchable embeddings.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3</span>
                    <span className="text-cyan-400 font-mono text-xs">Zero App Install</span>
                  </div>
                  <h4 className="mt-2 text-lg font-bold text-white">Guest Selfie Discovery</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Guests scan the event QR code, snap a selfie with consent, and view their personalized gallery within 800 milliseconds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audiences / Solutions */}
      <section id="solutions" className="py-20 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Built For High-Volume Photography</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Engineered for every high-stakes event.
            </p>
            <p className="mt-4 text-base text-slate-600">
              Replace cumbersome folder browsing with intelligent, instantaneous biometric photo discovery.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="novus-card p-6">
              <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 font-bold mb-4 text-2xl">
                💍
              </div>
              <h3 className="text-lg font-bold text-slate-900">Weddings & Receptions</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Give wedding guests instant access to their memories before the night ends. Elevate your studio&apos;s brand reputation.
              </p>
            </div>

            <div className="novus-card p-6">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4 text-2xl">
                🎓
              </div>
              <h3 className="text-lg font-bold text-slate-900">Schools & Universities</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Streamline graduation and sports day photo distribution for thousands of students and parents without manual tagging.
              </p>
            </div>

            <div className="novus-card p-6">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold mb-4 text-2xl">
                🏢
              </div>
              <h3 className="text-lg font-bold text-slate-900">Corporate Summits</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Empower attendees and keynote speakers to discover their stage and networking portraits for immediate social sharing.
              </p>
            </div>

            <div className="novus-card p-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold mb-4 text-2xl">
                🏃
              </div>
              <h3 className="text-lg font-bold text-slate-900">Marathons & Sports</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Deliver race finish line and action photographs to athletes by face recognition even when bib numbers are obscured.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Platform Pillars */}
      <section id="features" className="py-20 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Enterprise Technology</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Architected for security, scale, and compliance.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="novus-card p-8">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold mb-5 shadow-sm">
                01
              </div>
              <h3 className="text-xl font-bold text-slate-900">Multi-Tenant Studio Isolation</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Strict organization boundaries enforced at the API and database levels. Team roles for Studio Owners, Senior Photographers, and Retouchers.
              </p>
            </div>

            <div className="novus-card p-8">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold mb-5 shadow-sm">
                02
              </div>
              <h3 className="text-xl font-bold text-slate-900">Zero-Persistence Biometric Privacy</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Guest selfies are processed strictly in volatile RAM and never written to disk. Embeddings are scoped only to the requested event and purged on schedule.
              </p>
            </div>

            <div className="novus-card p-8">
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold mb-5 shadow-sm">
                03
              </div>
              <h3 className="text-xl font-bold text-slate-900">Signed Photo Tokens & Watermarking</h3>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Original image assets are protected behind HMAC-SHA256 expiring access tokens. Optional studio branding and download controls per plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial SaaS Pricing (Image 2 - In Indian Rupees) */}
      <section id="pricing" className="py-20 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">SAAS PRICING</h2>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Transparent plans that scale with your shoots.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="novus-card p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Starter Trial</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Free</h3>
                <p className="mt-2 text-sm text-slate-600">Ideal for exploring AI photo search on a sample shoot.</p>
                <div className="mt-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2">✓ 1 Active Event</div>
                  <div className="flex items-center gap-2">✓ Up to 300 Photos</div>
                  <div className="flex items-center gap-2">✓ 7-Day Event Retention</div>
                  <div className="flex items-center gap-2">✓ Standard QR Code Generator</div>
                </div>
              </div>
              <Link
                href="/admin"
                className="mt-8 block text-center rounded-lg border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Start Free
              </Link>
            </div>

            {/* Pro Studio Plan (Indian Rupees) */}
            <div className="novus-card p-8 flex flex-col justify-between border-blue-600 shadow-xl shadow-blue-500/10 relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                Most Popular
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Pro Studio</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">₹2,499</span>
                  <span className="text-sm font-semibold text-slate-500">/month</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">For active wedding and event photography studios.</p>
                <div className="mt-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-blue-900">✓ 15 Active Events per month</div>
                  <div className="flex items-center gap-2 font-semibold text-blue-900">✓ 15,000 Photos Indexed</div>
                  <div className="flex items-center gap-2">✓ Custom Studio Branding & QR Posters</div>
                  <div className="flex items-center gap-2">✓ 60-Day Event Retention</div>
                  <div className="flex items-center gap-2">✓ High-Res Full Gallery Downloads</div>
                  <div className="flex items-center gap-2">✓ Direct Upload + Google Drive</div>
                </div>
              </div>
              <Link
                href="/admin"
                className="mt-8 block text-center rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-600/20"
              >
                Upgrade to Pro Studio
              </Link>
            </div>

            {/* Enterprise Plan (Indian Rupees) */}
            <div className="novus-card p-8 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Enterprise</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">₹9,999</span>
                  <span className="text-sm font-semibold text-slate-500">/month</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">For universities, conference organizers, and sports circuits.</p>
                <div className="mt-6 border-t border-slate-100 pt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center gap-2">✓ Unlimited Active Events</div>
                  <div className="flex items-center gap-2">✓ 100,000+ Photos Indexed</div>
                  <div className="flex items-center gap-2">✓ Multi-User Team Roles (Owner, Staff)</div>
                  <div className="flex items-center gap-2">✓ Custom Domain (photos.yourstudio.com)</div>
                  <div className="flex items-center gap-2">✓ Dedicated Fast-Track GPU Ingestion</div>
                  <div className="flex items-center gap-2">✓ Dedicated SLA & Account Manager</div>
                </div>
              </div>
              <Link
                href="/admin"
                className="mt-8 block text-center rounded-lg border border-slate-300 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Contact Enterprise
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NovusGrid Digital Suite Ecosystem Section (Image 3) */}
      <div id="ecosystem" className="scroll-mt-16">
        <EcosystemSection />
      </div>

      {/* Global Comprehensive Footer (Image 4) */}
      <GlobalFooter />
    </div>
  );
}
