import { Inter } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Moglix IntelliDesk',
  description: 'Service desk MVP prototype',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
