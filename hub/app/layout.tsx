import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'APEx Hub | AI Operations Platform',
    template: '%s | APEx Hub',
  },
  description:
    'APEx Hub is your AI-powered executive operations platform — a unified command center for Chief of Staff, Sales, Finance, Customer Success, Legal Ops, and Product Management.',
  keywords: ['AI operations', 'executive assistant', 'business intelligence', 'workflow automation'],
  authors: [{ name: 'APEx' }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090e1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
