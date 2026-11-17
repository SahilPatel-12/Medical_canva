import type { Metadata } from "next";
import { AuthProvider } from "@design-platform/auth";
import { ThemeProvider } from "@design-platform/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioCanvas | Medical & Scientific Visual Design Platform",
  description: "Web-based design platform for figures, models, and scientific illustrations",
};

// Blocking inline script to prevent theme flash (FOUC)
const themeInitializerScript = `
(function() {
  try {
    var key = 'bio_canvas_theme';
    var stored = localStorage.getItem(key);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored === 'light' || stored === 'dark') ? stored : (prefersDark ? 'dark' : 'light');
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
        <ThemeProvider defaultTheme="light">
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
