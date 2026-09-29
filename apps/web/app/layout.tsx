import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Platform",
  description: "Web-based design platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
