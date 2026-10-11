import type { Metadata } from "next";
import { AuthProvider } from "@design-platform/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioCanvas | Medical & Scientific Visual Design Platform",
  description: "Web-based design platform for figures, models, and scientific illustrations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
