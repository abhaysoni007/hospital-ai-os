import React from 'react';
import type { Metadata } from 'next';
import { Inter, Syne, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, THEME_STORAGE_KEY } from '../context/ThemeContext';
import { ToastProvider } from '../components/ui/Toast/Toast';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const syne = Syne({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'MEDORA — The Intelligent Operating System for Modern Healthcare',
  description:
    'MEDORA connects clinical teams, diagnostic infrastructure, operational workflows, and intelligence systems into a unified digital environment.',
};

/**
 * Pre-hydration theme bootstrap. Runs before React mounts so the first paint
 * already carries the correct data-theme attribute on <html> and the user
 * never sees a light-mode flash before the dark theme applies (or vice versa).
 */
const themeBootstrap = `
(function () {
  try {
    var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    var mode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var resolved;
    if (mode === 'light' || mode === 'dark') {
      resolved = mode;
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${syne.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="haios-theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
