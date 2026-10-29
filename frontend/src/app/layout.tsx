import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-font-sans",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "EventLens — AI-Powered Event Photo Discovery Platform",
  description:
    "Commercial AI event photo discovery for photographers, wedding studios, corporate events, and colleges. Guests find their photos instantly with one selfie.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-slate-50 text-slate-900 min-h-screen selection:bg-blue-100 selection:text-blue-900`}>
        {children}
      </body>
    </html>
  );
}
