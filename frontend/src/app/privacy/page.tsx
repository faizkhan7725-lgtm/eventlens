import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
              NG
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">NovusGrid Event Photos</span>
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <article className="novus-card p-8 sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 mb-6">
            Biometric Data & Privacy Notice
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Biometric Information & Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-500 font-medium">
            Effective Date: October 2026 • NovusGrid Technologies
          </p>

          <div className="mt-8 space-y-6 text-sm sm:text-base leading-relaxed text-slate-700">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">1. Scope and Core Commitment</h2>
              <p>
                NovusGrid Event Photos provides AI-powered facial discovery services for event photography studios, educational institutions, corporations, and guests. We treat facial geometry and biometric data with the highest standard of technical privacy and statutory compliance (including the Illinois Biometric Information Privacy Act (BIPA), California Consumer Privacy Act (CCPA), and General Data Protection Regulation (GDPR)).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">2. How Facial Search Operates (Ephemeral Selfies)</h2>
              <p>
                When a guest utilizes our search service:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-2 text-slate-600">
                <li><strong>In-Memory Processing:</strong> The guest selfie uploaded or captured via webcam is streamed directly into volatile system memory (RAM). <strong>The selfie image file is never persisted to physical disk, database storage, or external cloud storage.</strong></li>
                <li><strong>Vector Generation:</strong> A mathematical facial vector (512-dimensional numerical embedding) is calculated strictly to measure similarity against photographs indexed in the specific event gallery.</li>
                <li><strong>Immediate Discard:</strong> As soon as the similarity search query completes (typically under 800 milliseconds), the temporary embedding and the raw selfie bytes are immediately released and purged from server memory.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">3. Event Gallery Face Embeddings</h2>
              <p>
                Photographs uploaded by the authorized event organizer are processed by background neural workers to identify face locations and compute vector representations. These vectors are strictly bound to the specific <code>event_id</code>. Under no circumstances are face embeddings aggregated across separate events, organizations, or public discovery databases.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">4. Data Retention & Automatic Purging</h2>
              <p>
                Search session records containing guest-provided contact details (name, phone, email) and search timestamp logs are retained solely for organizer audit verification. These records are subject to an automated retention schedule (default 30 days, or configured down to immediate purge). When an event is archived or permanently deleted by the organizer, all associated photo metadata, access logs, and face embeddings are permanently destroyed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">5. Security & Signed Photo Access</h2>
              <p>
                All photographic results returned to guests are guarded behind cryptographically signed, short-lived HMAC-SHA256 tokens (15-minute validity). Unauthenticated third parties cannot traverse or scrape event galleries.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-2">6. Contact & Data Controller Notice</h2>
              <p>
                For questions regarding event photo data, rights of erasure, or data subject access requests, guests may contact their designated event photographer directly or email NovusGrid Technologies at <code>privacy@novusgrid.com</code>.
              </p>
            </section>
          </div>
        </article>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-slate-500">
          © 2026 NovusGrid Technologies. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
