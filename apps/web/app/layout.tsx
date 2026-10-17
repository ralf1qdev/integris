import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Integris — Security for everything connected to your Discord", template: "%s · Integris" },
  description: "Monitor bots, secure webhooks, and protect your Discord server from risky integrations.",
  applicationName: "Integris",
};

export const viewport: Viewport = { themeColor: "#090B10", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{ style: { background: "#11151D", border: "1px solid #222937", color: "#F4F6FB" } }}
        />
      </body>
    </html>
  );
}
