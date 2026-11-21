import type { Metadata } from "next";
import { ThemeProvider } from "@design-platform/ui";
import { AdminShell } from "./_components/AdminShell";
import "./globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin Console - Medical Canva",
  description: "Internal administration interface",
};

// Blocking inline script to prevent theme flash (FOUC)
const themeInitializerScript = `
(function() {
  try {
    var key = 'bio_canvas_theme';
    var stored = localStorage.getItem(key);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored === 'light' || stored === 'dark') ? stored : (prefersDark ? 'dark' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializerScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark">
          <AdminShell>{children}</AdminShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
