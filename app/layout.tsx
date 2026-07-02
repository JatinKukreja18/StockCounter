import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "Sekai Stock Count", template: "%s · Sekai Stock Count" },
  description: "Offline-first physical stock counting for Sekai Ichiba.",
  applicationName: "Sekai Stock Count",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Stock Count" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" }
};

export const viewport: Viewport = {
  themeColor: "#18794e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
