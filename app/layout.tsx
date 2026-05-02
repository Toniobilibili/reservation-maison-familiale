import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthContext';

export const metadata: Metadata = {
  title: 'Maison Familiale',
  description: 'Gestion des réservations de la maison de vacances familiale.',
  metadataBase: new URL('https://example.com'),
  icons: {
    icon: '/icons/icon-192.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5B5EF2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
