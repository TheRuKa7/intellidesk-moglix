import { Source_Sans_3, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';

const sans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = Source_Code_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'IntelliDesk · Moglix',
    template: '%s · IntelliDesk',
  },
  description: 'Moglix service desk — employee portal and agent workbench',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
