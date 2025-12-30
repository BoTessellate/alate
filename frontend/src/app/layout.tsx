import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/AppLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Mood Layer - Creative Moodboard Platform",
  description: "Create and manage your creative moodboards",
};

// Inline script to prevent flash of wrong theme
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('mood-layer-settings');
    var theme = stored ? JSON.parse(stored).state.theme : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var effectiveTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
    var root = document.documentElement;

    if (effectiveTheme === 'light') {
      root.style.setProperty('--background', '#e8dcc8');
      root.style.setProperty('--background-secondary', '#ddd0ba');
      root.style.setProperty('--background-tertiary', '#d2c4ac');
      root.style.setProperty('--surface', '#f5ebe0');
      root.style.setProperty('--surface-light', '#ebe0d4');
      root.style.setProperty('--surface-elevated', '#faf6f0');
      root.style.setProperty('--foreground', '#2d3a24');
      root.style.setProperty('--foreground-secondary', '#4a5a3d');
      root.style.setProperty('--foreground-muted', '#6b7a5e');
      root.style.setProperty('--border', '#c4b8a0');
      root.style.setProperty('--border-light', '#b8a890');
      root.style.setProperty('--topbar-bg', 'rgba(76, 112, 49, 0.92)');
    }
    root.setAttribute('data-theme', effectiveTheme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
