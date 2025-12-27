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
      root.style.setProperty('--background', '#f8f6f3');
      root.style.setProperty('--background-secondary', '#f0ebe4');
      root.style.setProperty('--background-tertiary', '#e8e2d9');
      root.style.setProperty('--surface', '#ffffff');
      root.style.setProperty('--surface-light', '#f5f3f0');
      root.style.setProperty('--surface-elevated', '#fafafa');
      root.style.setProperty('--foreground', '#222222');
      root.style.setProperty('--foreground-secondary', '#555555');
      root.style.setProperty('--foreground-muted', '#888888');
      root.style.setProperty('--border', '#e0dcd5');
      root.style.setProperty('--border-light', '#d0ccc5');
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
