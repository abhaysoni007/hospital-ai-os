import type { Metadata } from 'next';
import { Syne, Space_Grotesk, Inter as Geist } from 'next/font/google';

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

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
  weight: ['300', '400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'MEDORA — The Intelligent Operating System for Modern Healthcare',
  description:
    'MEDORA connects the hospital\'s people, workflows, clinical information, diagnostics, operations, and intelligence into one coherent digital environment.',
  openGraph: {
    title: 'MEDORA — Intelligent Healthcare OS',
    description: 'The intelligent operating system for modern healthcare.',
    type: 'website',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${syne.variable} ${spaceGrotesk.variable} ${geist.variable}`}
      data-marketing="true"
    >
      {children}
    </div>
  );
}
