import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AgapAI — Emergency Response Platform',
  description: 'AI-powered emergency response and decision-support platform. Your voice is the emergency report.',
  icons: { icon: '/logo.jpg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css"
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
