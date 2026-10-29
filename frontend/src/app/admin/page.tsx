import AdminDashboard from "@/components/admin-dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs sm:text-sm shadow-sm shadow-blue-500/20 shrink-0">
                NG
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">NovusGrid</span>
                <span className="hidden xs:inline-block text-[11px] font-semibold text-slate-500">Studio</span>
              </div>
            </Link>
            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 pl-4">
              <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">
                Pro Studio Tier
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Home
            </Link>
            <Link
              href="/privacy"
              className="hidden sm:inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
            >
              Privacy Notice
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <AdminDashboard />
      </main>
    </div>
  );
}
