import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import PwaRuntime from '@/components/pwa/PwaRuntime';
import LinkStatusBanner from '@/components/pwa/LinkStatusBanner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'AgapAI — Emergency Response Command Center',
  description:
    'AI-powered emergency response and decision-support platform. Reports queue locally and send automatically when signal returns.',
  manifest: '/manifest.webmanifest',
  applicationName: 'AgapAI',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AgapAI',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'AgapAI — Emergency Response Command Center',
    description: 'Report emergencies in seconds. Works even with no cell coverage.',
    type: 'website',
  },
};

/**
 * Next 16 splits these: theme-color/viewport live on their own export, not
 * inside `metadata`. Server Components only.
 */
export const viewport: Viewport = {
  themeColor: '#0A0A0D',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="dark">
        <PwaRuntime />
        <TooltipProvider>
          <LinkStatusBanner />
          {children}
        <script
          defer
          src="https://pulse.joalvergs.tech/p.js"
          data-site="agapai"
        />

        </TooltipProvider>
      </body>
    </html>
  );
}
