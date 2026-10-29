"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  createEvent,
  listDriveFolders,
  type DashboardStats,
  type DriveFolderListResponse,
  deleteEvent,
  deleteGuestSearch,
  listEvents,
  permanentlyDeleteEvent,
  reindexEvent,
  restoreEvent,
  syncEvent,
  syncProfile,
  type Event,
  type GuestSearch,
  type Photographer,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import DirectPhotoUploader from "@/components/direct-photo-uploader";
import VenuePrintStudio from "@/components/venue-print-studio";

function progressPercent(event: Event) {
  if (!event.photos_total) return 0;
  return Math.round((event.photos_indexed / event.photos_total) * 100);
}

function eventStatus(event: Event) {
  if (event.status === "archived") {
    return { label: "Archived", className: "bg-slate-100 text-slate-700 border border-slate-200" };
  }
  if (event.photos_failed > 0) {
    return { label: "Needs Review", className: "bg-amber-50 text-amber-700 border border-amber-200" };
  }
  if (event.photos_total > 0 && event.photos_indexed === event.photos_total) {
    return { label: "Guest Ready", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  }
  if (event.photos_processing > 0 || event.photos_pending > 0) {
    return { label: "Indexing Photos", className: "bg-blue-50 text-blue-700 border border-blue-200" };
  }
  return { label: "Setup Required", className: "bg-slate-100 text-slate-700 border border-slate-200" };
}

function shortEventId(eventId: string) {
  return eventId.split("-")[0]?.toUpperCase() ?? eventId.slice(0, 8).toUpperCase();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((lineText, index) => {
    const isLastVisibleLine = index === maxLines - 1 && lines.length > maxLines;
    const displayText = isLastVisibleLine ? `${lineText.replace(/\s+\S*$/, "")}...` : lineText;
    context.fillText(displayText, x, y + index * lineHeight);
  });
}

async function makeEventShareImage(event: Event, qrDataUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image export is not available in this browser.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, canvas.width, 260);
  context.fillStyle = "#2563eb";
  context.fillRect(0, 250, canvas.width, 12);

  context.fillStyle = "#93c5fd";
  context.font = "700 28px Arial, sans-serif";
  context.fillText("NOVUSGRID EVENT PHOTOS", 72, 92);

  context.fillStyle = "#ffffff";
  context.font = "900 58px Arial, sans-serif";
  wrapCanvasText(context, event.name, 72, 178, 936, 68, 2);

  context.fillStyle = "#0f172a";
  context.font = "900 40px Arial, sans-serif";
  context.fillText("Scan to open gallery", 72, 350);

  context.fillStyle = "#64748b";
  context.font = "500 28px Arial, sans-serif";
  context.fillText("Guests open the link, snap a selfie, and discover their photos instantly.", 72, 398);

  context.fillStyle = "#ffffff";
  context.fillRect(240, 470, 600, 600);
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 6;
  context.strokeRect(240, 470, 600, 600);

  const qrImage = await loadImage(qrDataUrl);
  context.drawImage(qrImage, 288, 518, 504, 504);

  context.fillStyle = "#f8fafc";
  context.fillRect(72, 1138, 936, 124);
  context.strokeStyle = "#e2e8f0";
  context.lineWidth = 2;
  context.strokeRect(72, 1138, 936, 124);

  context.fillStyle = "#0f172a";
  context.font = "900 28px Arial, sans-serif";
  context.fillText(`Event ID: ${shortEventId(event.id)}`, 112, 1194);

  context.fillStyle = "#64748b";
  context.font = "500 24px Arial, sans-serif";
  wrapCanvasText(context, event.public_url, 112, 1238, 856, 32, 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not create event QR image."));
      }
    }, "image/png");
  });
}

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [guestSearches, setGuestSearches] = useState<GuestSearch[]>([]);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [eventName, setEventName] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [selectedFolderName, setSelectedFolderName] = useState("");
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);
  const [reindexingEventId, setReindexingEventId] = useState<string | null>(null);
  const [shareEvent, setShareEvent] = useState<Event | null>(null);
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null);
  const [shareBusyAction, setShareBusyAction] = useState<"copy" | "download" | "share" | null>(null);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [drivePickerState, setDrivePickerState] = useState<DriveFolderListResponse | null>(null);
  const [guestSearchesOpen, setGuestSearchesOpen] = useState(false);
  const [eventView, setEventView] = useState<"active" | "archived">("active");
  const [sourceType, setSourceType] = useState<"direct" | "drive">("direct");
  const [uploadModalEvent, setUploadModalEvent] = useState<Event | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const syncInFlightRef = useRef(false);

  const refreshEventData = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setPhotographer(null);
      setEvents([]);
      setGuestSearches([]);
      setStats(null);
      return;
    }

    try {
      setSessionToken(session.access_token);
      const data = await listEvents(session.access_token, eventView);
      setEvents(data.events);
      setGuestSearches(data.guest_searches);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    }
  }, [eventView, supabase]);

  const loadDashboard = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setPhotographer(null);
        setEvents([]);
        setGuestSearches([]);
        setStats(null);
        setLoading(false);
        return;
      }

      const sessionWithProvider = session as typeof session & {
        provider_token?: string;
        provider_refresh_token?: string;
      };

      const profile = await syncProfile(session.access_token, {
        provider_token: sessionWithProvider.provider_token,
        provider_refresh_token: sessionWithProvider.provider_refresh_token,
      });
      setPhotographer(profile);
      await refreshEventData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      syncInFlightRef.current = false;
      setLoading(false);
    }
  }, [refreshEventData, supabase.auth]);

  useEffect(() => {
    loadDashboard();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadDashboard();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadDashboard, supabase.auth]);

  useEffect(() => {
    if (!shareEvent) {
      setShareQrDataUrl(null);
      setShareBusyAction(null);
      return;
    }

    let active = true;
    QRCode.toDataURL(shareEvent.public_url, {
      margin: 1,
      width: 480,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (active) setShareQrDataUrl(dataUrl);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not generate QR code");
        }
      });

    return () => {
      active = false;
    };
  }, [shareEvent]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setError("Please provide both email and password.");
      return;
    }
    setError(null);
    setNotice(null);
    setAuthSubmitting(true);
    try {
      if (authMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setNotice("Account created! Logging in...");
          await loadDashboard();
        } else {
          setNotice("Account created successfully! You can now sign in.");
          setAuthMode("signin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (signInError) throw signInError;
        setNotice("Signed in successfully!");
        await loadDashboard();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleSignIn() {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile https://www.googleapis.com/auth/drive.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (signInError) {
      setError(signInError.message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setPhotographer(null);
    setEvents([]);
    setGuestSearches([]);
    setStats(null);
    setNotice("Signed out successfully.");
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const created = await createEvent(session.access_token, {
        name: eventName.trim(),
        source_type: sourceType,
        drive_folder_id: sourceType === "drive" ? driveFolderId.trim() : null,
      });
      setEventName("");
      setDriveFolderId("");
      setSelectedFolderName("");
      await refreshEventData();
      if (sourceType === "direct") {
        setNotice("Event created! Select or drop your photos now to start indexing.");
        setUploadModalEvent(created);
      } else {
        setNotice("Event created successfully! Initial sync and indexing jobs queued.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    const confirmed = window.confirm("Archive this event? Guests will no longer be able to search it.");
    if (!confirmed) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await deleteEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Event archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive event");
    }
  }

  async function handleDeleteGuestSearch(sessionId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await deleteGuestSearch(session.access_token, sessionId);
      await refreshEventData();
      setNotice("Guest search record deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete guest search");
    }
  }

  async function handleRestoreEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await restoreEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Event restored and public link is active again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore event");
    }
  }

  async function handlePermanentDeleteEvent(eventId: string) {
    const confirmed = window.confirm(
      "Permanently delete this archived event and all photo records/search history? This cannot be undone."
    );
    if (!confirmed) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await permanentlyDeleteEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice("Archived event permanently deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete event");
    }
  }

  async function handleSyncEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setSyncingEventId(eventId);
    setError(null);
    setNotice(null);
    try {
      const result = await syncEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice(
        `Drive sync finished: scanned ${result.scanned}, added ${result.created}, updated ${result.updated}, removed ${result.deleted}, queued ${result.queued} for indexing.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync event photos");
    } finally {
      setSyncingEventId(null);
    }
  }

  async function handleReindexEvent(eventId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setReindexingEventId(eventId);
    setError(null);
    setNotice(null);
    try {
      const result = await reindexEvent(session.access_token, eventId);
      await refreshEventData();
      setNotice(`Queued ${result.queued} photos for full reindex.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue photo indexing");
    } finally {
      setReindexingEventId(null);
    }
  }

  async function loadDriveFolders(parentId?: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setDrivePickerOpen(true);
    setDrivePickerLoading(true);
    setError(null);
    try {
      const response = await listDriveFolders(session.access_token, parentId);
      setDrivePickerState(response);
    } catch (err) {
      setDrivePickerOpen(false);
      setError(err instanceof Error ? err.message : "Failed to browse Google Drive");
    } finally {
      setDrivePickerLoading(false);
    }
  }

  function handleChooseFolder(folderId: string, folderName: string) {
    setDriveFolderId(folderId);
    setSelectedFolderName(folderName);
    setDrivePickerOpen(false);
  }

  async function copyEventLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Event link copied to clipboard.");
    } catch {
      setError("Could not copy link automatically.");
    }
  }

  async function downloadEventQr(event: Event) {
    if (!shareQrDataUrl) return;

    setShareBusyAction("download");
    setError(null);
    try {
      const blob = await makeEventShareImage(event, shareQrDataUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${event.slug}-novusgrid-qr.png`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Event QR image downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download QR image");
    } finally {
      setShareBusyAction(null);
    }
  }

  async function copyEventQrImage(event: Event) {
    if (!shareQrDataUrl) return;

    setShareBusyAction("copy");
    setError(null);
    try {
      const blob = await makeEventShareImage(event, shareQrDataUrl);
      const clipboard = navigator.clipboard;
      if (!clipboard?.write) {
        throw new Error("Copying images to clipboard is not supported in this browser.");
      }
      await clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setNotice("Event QR image copied to clipboard.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy QR image");
    } finally {
      setShareBusyAction(null);
    }
  }

  const readyPercent = useMemo(() => {
    if (!stats || !stats.photos_total) return 0;
    return Math.round((stats.photos_indexed / stats.photos_total) * 100);
  }, [stats]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-6">
        <div className="novus-card p-8 text-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Loading Workspace</p>
          <p className="mt-1 text-sm text-slate-500">Connecting to NovusGrid Event Studio...</p>
        </div>
      </div>
    );
  }

  if (!photographer) {
    return (
      <div className="mx-auto grid min-h-[82vh] max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-2">
        <div>
          <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">
            Studio Photographer Portal
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Deliver event galleries guests can search by selfie.
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
            Connect your photography portfolio, index high-resolution galleries automatically, and share private guest links or venue QR codes.
          </p>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-sm font-bold text-slate-800">
                {authMode === "signin" ? "Studio Sign In" : "Create Studio Account"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
              >
                {authMode === "signin" ? "New studio? Create account" : "Already have an account? Sign in"}
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@studio.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:opacity-50"
              >
                {authSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : null}
                <span>{authMode === "signin" ? "Sign In to Studio" : "Create Free Studio Account"}</span>
              </button>
            </form>


          </div>
        </div>

        <div className="novus-card p-8 bg-white border border-slate-200">
          <div className="rounded-xl bg-slate-900 text-white p-6">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Studio Onboarding</span>
            <div className="mt-6 space-y-4">
              <div className="flex gap-4 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">1</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Create & Upload Event</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Upload high-res photos directly from mobile or desktop.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">2</span>
                <div>
                  <h4 className="text-sm font-bold text-white">AI Neural Face Indexing</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Automated face extraction & 512-dim vector generation.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">3</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Share Venue QR Cards</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Guests snap a selfie to receive their photos on the event day.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      {/* Studio Banner */}
      <section className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">
            Studio Command Center
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {photographer.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {photographer.email} • {photographer.has_drive_access ? "Google Drive Connected" : "Drive Access Pending"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setGuestSearchesOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Guest Audit Log ({guestSearches.length})
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* KPI Stats Overview */}
      {stats && (
        <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="novus-card p-5 bg-white border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Events</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.events_count}</p>
            <p className="mt-1 text-xs text-slate-500">{stats.ready_events_count} ready for guests</p>
          </div>

          <div className="novus-card p-5 bg-white border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Indexed Photos</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.photos_indexed}</p>
            <p className="mt-1 text-xs text-slate-500">of {stats.photos_total} total photos ({readyPercent}%)</p>
          </div>

          <div className="novus-card p-5 bg-white border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Guest Searches</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.searches_total}</p>
            <p className="mt-1 text-xs text-slate-500">Selfie queries executed</p>
          </div>

          <div className="novus-card p-5 bg-white border border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Delivered Matches</span>
            <p className="mt-2 text-3xl font-extrabold text-slate-900">{stats.matches_total}</p>
            <p className="mt-1 text-xs text-slate-500">Photos returned to guests</p>
          </div>
        </section>
      )}

      {/* Create Event & Checklist */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleCreateEvent} className="novus-card p-6 bg-white border border-slate-200">
          <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">New Event Gallery</span>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Create & Index Gallery</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Specify an event name and connect a Google Drive folder containing photos.
          </p>

          <div className="mt-5 space-y-4">
            {/* Mobile-First Source Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Photo Ingestion Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSourceType("direct")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                    sourceType === "direct"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>📸</span>
                  <span>Direct Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("drive")}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition ${
                    sourceType === "drive"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>📁</span>
                  <span>Google Drive</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Rohan & Neha Wedding"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {sourceType === "direct" ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900">
                <p className="font-bold flex items-center gap-1.5">
                  <span>⚡</span> Direct Upload Enabled
                </p>
                <p className="mt-1 text-slate-600 leading-relaxed">
                  Upload directly from your phone camera, mobile gallery, or laptop. No Google Drive setup required.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Drive Folder</label>
                <input
                  type="text"
                  required
                  value={driveFolderId}
                  onChange={(e) => {
                    setDriveFolderId(e.target.value);
                    if (selectedFolderName) setSelectedFolderName("");
                  }}
                  placeholder="Paste Drive Folder ID or URL"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                />
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => loadDriveFolders()}
                    disabled={drivePickerLoading}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {drivePickerLoading ? "Loading..." : "Browse Google Drive"}
                  </button>
                  {selectedFolderName && (
                    <span className="text-xs text-slate-600 font-medium">
                      Folder: <strong className="text-slate-900">{selectedFolderName}</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300"
          >
            {creating ? "Creating & Syncing..." : "Create Event"}
          </button>
        </form>

        <div className="novus-card p-6 bg-white border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="novus-badge bg-slate-100 text-slate-700 border border-slate-200">
              Pro Studio Standards
            </span>
            <h3 className="mt-2 text-xl font-bold text-slate-900">Event Readiness Blueprint</h3>
            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">High-Resolution Originals</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Upload JPEG/PNG/WebP portraits. Clear lighting improves match precision.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Background Face Vectorizing</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Celery workers compute 512-dim face embeddings stored securely in pgvector.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Venue Tent Card Export</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Download print-ready QR cards for display on event tables and signage.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Events Management Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Client Event Galleries</h3>
            <p className="text-xs text-slate-500">Manage galleries, trigger re-indexing, and configure QR sharing.</p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(["active", "archived"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setEventView(view)}
                className={`rounded-md px-3 py-1 text-xs font-bold capitalize transition ${
                  eventView === view ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {view} Events
              </button>
            ))}
          </div>
        </div>

        {events.length === 0 ? (
          <div className="novus-card p-12 text-center bg-white border border-slate-200">
            <p className="text-sm font-semibold text-slate-700">No {eventView} events found.</p>
            <p className="text-xs text-slate-500 mt-1">Create an event above to start indexing photos.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => {
              const status = eventStatus(event);
              const progress = progressPercent(event);

              return (
                <article key={event.id} className="novus-card p-6 bg-white border border-slate-200">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="text-lg font-bold text-slate-900 truncate">{event.name}</h4>
                        <span className={`novus-badge ${status.className}`}>{status.label}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3 max-w-md">
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Indexed</span>
                          <p className="text-base font-extrabold text-slate-900">{event.photos_indexed}/{event.photos_total}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Searches</span>
                          <p className="text-base font-extrabold text-slate-900">{event.search_count}</p>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Progress</span>
                          <p className="text-base font-extrabold text-slate-900">{progress}%</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1.5 max-w-md overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                      </div>

                      {event.status === "active" ? (
                        <a
                          href={event.public_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-semibold text-blue-600 hover:underline truncate max-w-md"
                        >
                          🔗 {event.public_url}
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Public link disabled</span>
                      )}
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
                      {event.status === "active" ? (
                        <>
                          <button
                            onClick={() => setUploadModalEvent(event)}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5"
                          >
                            <span>📸</span>
                            <span>Upload Photos</span>
                          </button>
                          <button
                            onClick={() => setShareEvent(event)}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                          >
                            Share & QR Studio
                          </button>
                          <button
                            onClick={() => handleSyncEvent(event.id)}
                            disabled={syncingEventId === event.id}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                          >
                            {syncingEventId === event.id ? "Syncing..." : "Sync Drive Photos"}
                          </button>
                          <button
                            onClick={() => handleReindexEvent(event.id)}
                            disabled={reindexingEventId === event.id}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                          >
                            {reindexingEventId === event.id ? "Reindexing..." : "Re-Index Faces"}
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="rounded-lg px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                          >
                            Archive Event
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRestoreEvent(event.id)}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                          >
                            Restore Event
                          </button>
                          <button
                            onClick={() => handlePermanentDeleteEvent(event.id)}
                            className="rounded-lg px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                          >
                            Delete Permanently
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Google Drive Folder Browser Modal */}
      {drivePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="novus-card max-h-[85vh] w-full max-w-3xl overflow-hidden bg-white flex flex-col">
            <div className="border-b border-slate-200 p-5 flex items-center justify-between">
              <div>
                <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">Google Drive Ingestion</span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {drivePickerState?.current_folder_name ?? "Drive Folders"}
                </h3>
              </div>
              <button
                onClick={() => setDrivePickerOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 p-2"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto p-5 flex-1 space-y-2">
              {drivePickerLoading && (
                <div className="py-8 text-center text-xs text-slate-500">Loading Google Drive directories...</div>
              )}
              {drivePickerState?.folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition"
                >
                  <span className="text-sm font-semibold text-slate-900 truncate">{folder.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadDriveFolders(folder.id)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleChooseFolder(folder.id, folder.name)}
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Select
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Guest Searches Audit Log Modal */}
      {guestSearchesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="novus-card max-h-[90vh] w-full max-w-5xl overflow-hidden bg-white flex flex-col">
            <div className="border-b border-slate-200 p-5 flex items-center justify-between">
              <div>
                <span className="novus-badge bg-blue-50 text-blue-700 border border-blue-200">Audit & Compliance</span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Guest Search Activity Records</h3>
              </div>
              <button
                onClick={() => setGuestSearchesOpen(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 p-2"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto p-5 flex-1">
              {guestSearches.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No guest searches recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {guestSearches.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{s.guest_name || "Anonymous Guest"}</p>
                        <p className="text-slate-500">{s.guest_email} • {s.guest_phone}</p>
                      </div>
                      <span className="novus-badge bg-slate-100 text-slate-700">{s.match_count} matches</span>
                      <span className="text-slate-400">{new Date(s.searched_at).toLocaleString()}</span>
                      <button
                        onClick={() => void handleDeleteGuestSearch(s.id)}
                        className="text-red-600 hover:underline font-bold"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Venue Print & QR Studio Modal */}
      {shareEvent && (
        <VenuePrintStudio
          event={shareEvent}
          isOpen={true}
          onClose={() => setShareEvent(null)}
        />
      )}

      {/* Direct Photo Uploader Modal/Sheet */}
      {uploadModalEvent && (
        <DirectPhotoUploader
          event={uploadModalEvent}
          accessToken={sessionToken}
          isOpen={true}
          onClose={() => setUploadModalEvent(null)}
          onUploadComplete={async () => {
            await refreshEventData();
          }}
        />
      )}
    </main>
  );
}
