import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trading Terminal",
  description: "Professional AI-powered trading terminal with real-time market analysis, live signals, and intelligent decision support.",
  keywords: ["trading", "AI", "forex", "crypto", "market analysis", "terminal"],
  authors: [{ name: "AI Trading Terminal" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(13, 17, 24, 0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e6edf3",
            },
          }}
        />
      </body>
    </html>
  );
}
